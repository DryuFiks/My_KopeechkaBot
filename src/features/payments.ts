import { Bot, InlineKeyboard } from "grammy";
import { createPayment, deletePayment, findPayment, listPayments, togglePaymentActive } from "../db/payments";
import { insertTransaction } from "../db";
import { convertToGel, isSupportedCurrency, refreshRatesIfStale } from "../currency";
import { getUserSettings } from "../db/settings";
import { announceProgress } from "./progress";
import { confirmActionKeyboard, mainKeyboard, undoKeyboard } from "../keyboards";
import { editOrReply } from "../editOrReply";
import { escapeHtml, formatMoney, formatSignedAmount, renderScreen, PARSE_MODE } from "../format";
import { recordIdempotentGuardHit } from "../metrics";
import { safe, safeCallback } from "../middleware/safe";

function paymentLine(p: {
  id: number;
  title: string;
  amount: string;
  currency: string;
  due_day: number;
  active: boolean;
}): string {
  const status = p.active ? "✅ активен" : "⏸ на паузе";
  return `${p.id}. «${escapeHtml(p.title)}» — ${formatMoney(p.amount, p.currency)}, ежемесячно, день ${p.due_day} · ${status}`;
}

function paymentsKeyboard(payments: { id: number; title: string; active: boolean }[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const p of payments) {
    const label = p.active ? `⏸ ${p.title}` : `▶️ ${p.title}`;
    keyboard.text(label.slice(0, 60), `paypause:${p.id}`).row();
  }
  return keyboard.text("⬅️ Главное меню", "menu:planning");
}

async function renderPaymentsScreen(userId: number) {
  const payments = await listPayments(userId);
  const text = renderScreen({
    title: "Регулярные платежи",
    lines: payments.map(paymentLine),
    emptyText: "Платежей пока нет. Создание: /payment день сумма валюта название",
  });
  return { text, keyboard: paymentsKeyboard(payments) };
}

// Guards a payrem:<id>:record tap against a near-simultaneous duplicate delivery of the
// same callback — cleared right after processing so future months' reminders for the
// same payment id are never permanently blocked, only concurrent taps on one reminder.
const recordingReminder = new Set<number>();

export function registerPaymentsHandlers(bot: Bot): void {
  bot.command(
    "payment",
    safe("payment", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const m = /^\/payment\s+(\d{1,2})\s+(\d+(?:[.,]\d{1,2})?)\s+(RUB|GEL|USD)\s+(.+)$/i.exec(
        ctx.message?.text ?? "",
      );
      if (!m) {
        const { text, keyboard } = await renderPaymentsScreen(uid);
        await ctx.reply(text, { parse_mode: PARSE_MODE, reply_markup: keyboard });
        return;
      }
      const dueDay = Number(m[1]);
      if (dueDay < 1 || dueDay > 31) {
        await ctx.reply("День месяца должен быть от 1 до 31.", { reply_markup: mainKeyboard });
        return;
      }
      const currency = m[3].toUpperCase();
      if (!isSupportedCurrency(currency)) {
        await ctx.reply("Неизвестная валюта. Поддерживаются: RUB, GEL, USD.", { reply_markup: mainKeyboard });
        return;
      }
      await createPayment(uid, dueDay, Number(m[2].replace(",", ".")), currency, m[4].trim().slice(0, 120));
      await ctx.reply("Регулярный платёж добавлен.", { reply_markup: mainKeyboard });
    }),
  );

  bot.command(
    "payments",
    safe("payments", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const { text, keyboard } = await renderPaymentsScreen(uid);
      await ctx.reply(text, { parse_mode: PARSE_MODE, reply_markup: keyboard });
    }),
  );

  bot.callbackQuery(
    "action:payments",
    safeCallback("action:payments", async (ctx) => {
      const { text, keyboard } = await renderPaymentsScreen(ctx.from.id);
      await editOrReply(ctx, text, { reply_markup: keyboard, parse_mode: PARSE_MODE });
    }),
  );

  bot.callbackQuery(
    /^paypause:(\d+)$/,
    safeCallback("paypause", async (ctx) => {
      const payment = await togglePaymentActive(ctx.from.id, Number(ctx.match[1]));
      if (!payment) {
        await ctx.answerCallbackQuery({ text: "Платёж не найден", show_alert: true });
        return;
      }
      await ctx.answerCallbackQuery({ text: payment.active ? "Возобновлён" : "На паузе" });
      const { text, keyboard } = await renderPaymentsScreen(ctx.from.id);
      await editOrReply(ctx, text, { reply_markup: keyboard, parse_mode: PARSE_MODE });
    }),
  );

  bot.command(
    "deletepayment",
    safe("deletepayment", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const id = Number((ctx.message?.text ?? "").split(/\s+/)[1]);
      if (!Number.isInteger(id) || id < 1) {
        await ctx.reply("Формат: /deletepayment ID", { reply_markup: mainKeyboard });
        return;
      }
      const payment = await findPayment(uid, id);
      if (!payment) {
        await ctx.reply("Платёж не найден.", { reply_markup: mainKeyboard });
        return;
      }
      await ctx.reply(`Удалить платёж «${escapeHtml(payment.title)}» навсегда?`, {
        parse_mode: PARSE_MODE,
        reply_markup: confirmActionKeyboard(`delpay:${id}:yes`, `delpay:${id}:no`),
      });
    }),
  );

  bot.callbackQuery(
    /^delpay:(\d+):(yes|no)$/,
    safeCallback("deletepayment confirm", async (ctx) => {
      if (ctx.match[2] === "no") {
        await ctx.answerCallbackQuery({ text: "Отменено" });
        await ctx.editMessageText("Действие отменено.", { reply_markup: mainKeyboard }).catch(() => {});
        return;
      }
      const deleted = await deletePayment(ctx.from.id, Number(ctx.match[1]));
      if (!deleted) recordIdempotentGuardHit();
      await ctx.answerCallbackQuery({ text: deleted ? "Платёж удалён" : "Уже удалён" });
      await ctx
        .editMessageText(deleted ? "Платёж удалён." : "Платёж уже удалён или не найден.", {
          reply_markup: mainKeyboard,
        })
        .catch(() => {});
    }),
  );

  bot.callbackQuery(
    /^payrem:(\d+):(record|skip)$/,
    safeCallback("payrem", async (ctx) => {
      const id = Number(ctx.match[1]);
      const action = ctx.match[2];
      const uid = ctx.from.id;

      if (action === "skip") {
        await ctx.answerCallbackQuery({ text: "Отложено" });
        await ctx
          .editMessageText("Отложено — расход не записан.", { reply_markup: mainKeyboard })
          .catch(() => {});
        return;
      }

      if (recordingReminder.has(id)) {
        recordIdempotentGuardHit();
        await ctx.answerCallbackQuery({ text: "Уже обрабатывается" });
        return;
      }
      recordingReminder.add(id);
      try {
        const payment = await findPayment(uid, id);
        if (!payment || !payment.active) {
          await ctx.answerCallbackQuery({ text: "Платёж не найден или удалён", show_alert: true });
          return;
        }
        await refreshRatesIfStale();
        const amount = Number(payment.amount);
        const { exchangeFactor } = await getUserSettings(uid);
        const amountGel = convertToGel(amount, payment.currency, exchangeFactor);
        const saved = await insertTransaction({
          userId: uid,
          type: "expense",
          amount,
          currency: payment.currency,
          amountGel,
          category: payment.category,
          note: `Регулярный платёж: ${payment.title}`,
        });
        await ctx.answerCallbackQuery({ text: "Записано" });
        await ctx
          .editMessageText(
            `Записано: ${formatSignedAmount("expense", saved.amount, saved.currency)} — «${escapeHtml(payment.title)}»`,
            { reply_markup: undoKeyboard(saved.id), parse_mode: PARSE_MODE },
          )
          .catch(() => {});
        await announceProgress(ctx, uid);
      } finally {
        recordingReminder.delete(id);
      }
    }),
  );
}
