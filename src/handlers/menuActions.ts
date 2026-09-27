import { Bot } from "grammy";
import { pool } from "../db";
import { mainKeyboard } from "../keyboards";
import { refreshRatesIfStale, getAllRateInfo } from "../currency";
import { flows, showBudget } from "../features/common";
import { logger } from "../logger";
import { escapeHtml, PARSE_MODE } from "../format";

const HELP = `Команды:
 /today — итоги за сегодня
 /month — итоги за месяц
 /last — последние операции
 /stats — расходы по категориям
 /export — выгрузка CSV
 /undo — отменить последнюю операцию
 /rate — курсы валют`;

async function editOrReply(ctx: any, text: string, keyboard = mainKeyboard, parseMode?: string) {
  const options: any = { reply_markup: keyboard };
  if (parseMode) options.parse_mode = parseMode;
  try {
    await ctx.editMessageText(text, options);
  } catch {
    await ctx.reply(text, options);
  }
}

export function registerMenuActionHandlers(bot: Bot): void {
  bot.callbackQuery(/^action:(expense|income)$/, async (ctx) => {
    const type = ctx.match[1] === "expense" ? "expense" : "income";
    const uid = ctx.from.id;
    flows.set(uid, { type, stage: "amount" });
    await ctx.answerCallbackQuery();
    await editOrReply(
      ctx,
      `Введи сумму ${type === "expense" ? "расхода" : "дохода"}, например: 25 GEL Еда обед\nМожно и в старом формате: -25 gel еда обед`,
      mainKeyboard,
    );
  });

  bot.callbackQuery("action:budget", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showBudget(ctx, ctx.from.id);
  });

  bot.callbackQuery("action:stats", async (ctx) => {
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, "Команда /stats покажет расходы по категориям. /export — выгрузка CSV.");
  });

  bot.callbackQuery("action:history", async (ctx) => {
    const r = await pool.query(
      "SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 10",
      [ctx.from.id],
    );
    const text = r.rowCount
      ? r.rows
          .map(
            (x: any) =>
              `${x.type === "expense" ? "−" : "+"}${x.amount} ${x.currency} ${escapeHtml(x.category ?? "")} ${escapeHtml(x.note ?? "")}`,
          )
          .join("\n")
      : "Операций пока нет.";
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, text, mainKeyboard, PARSE_MODE);
  });

  bot.callbackQuery("action:payments", async (ctx) => {
    const r = await pool.query(
      "SELECT id,title,amount,currency,due_day FROM recurring_payments WHERE user_id=$1 AND active ORDER BY due_day",
      [ctx.from.id],
    );
    const text = r.rowCount
      ? r.rows
          .map((x: any) => `${x.id}. ${escapeHtml(x.title)} — ${x.amount} ${x.currency}, день ${x.due_day}`)
          .join("\n")
      : "Регулярных платежей нет.";
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, text, mainKeyboard, PARSE_MODE);
  });

  bot.callbackQuery("action:goals", async (ctx) => {
    const r = await pool.query(
      "SELECT id,title,saved_gel,target_gel FROM savings_goals WHERE user_id=$1 AND active ORDER BY id",
      [ctx.from.id],
    );
    const text = r.rowCount
      ? r.rows
          .map(
            (x: any) =>
              `${x.id}. ${escapeHtml(x.title)} — ${Number(x.saved_gel).toFixed(2)} / ${Number(x.target_gel).toFixed(2)} GEL`,
          )
          .join("\n")
      : "Целей пока нет. Создать: /goal Название сумма\nПополнить: /save ID сумма";
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, text, mainKeyboard, PARSE_MODE);
  });

  bot.callbackQuery("action:rates", async (ctx) => {
    await refreshRatesIfStale();
    const lines = getAllRateInfo().map((r) =>
      r.rateToGel === null
        ? `${r.currency} → курс недоступен`
        : `${r.currency} → ${r.rateToGel.toFixed(4)} GEL${r.isFallback ? " ⚠️ кеш" : ""}`,
    );
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, `Курсы валют (NBG):\n${lines.join("\n")}`, mainKeyboard);
  });

  bot.callbackQuery("action:help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await editOrReply(ctx, HELP);
  });

  bot.callbackQuery("action:settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    await editOrReply(
      ctx,
      "Настройки: валюта по умолчанию GEL. Доступные валюты: GEL, RUB, USD.\nКоманды: /category, /budget, /payment, /goal, /export",
    );
  });

  bot.callbackQuery("action:restart", async (ctx) => {
    const adminId = Number(process.env.ADMIN_TELEGRAM_ID);
    if (!Number.isInteger(adminId) || adminId <= 0 || ctx.from.id !== adminId) {
      await ctx.answerCallbackQuery({ text: "Перезапуск доступен только администратору.", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery({ text: "Перезапускаю..." });
    logger.info(`Restart requested by admin ${ctx.from.id}`);
    setTimeout(() => process.exit(75), 3000);
  });
}
