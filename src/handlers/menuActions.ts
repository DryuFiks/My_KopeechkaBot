import { Bot } from "grammy";
import { pool } from "../db";
import { mainKeyboard, paginationKeyboard } from "../keyboards";
import { refreshRatesIfStale, getAllRateInfo } from "../currency";
import { flows, showBudget } from "../features/common";
import { logger } from "../logger";
import {
  escapeHtml,
  formatDateShort,
  formatMoney,
  formatSignedAmount,
  paginate,
  renderScreen,
  PARSE_MODE,
} from "../format";
import { safeCallback } from "../middleware/safe";

const HISTORY_PAGE_SIZE = 10;
const HISTORY_FETCH_LIMIT = 50;

async function renderHistoryPage(userId: number, page: number) {
  const r = await pool.query(
    "SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2",
    [userId, HISTORY_FETCH_LIMIT],
  );
  const lines = r.rows.map((x: any) =>
    `${formatDateShort(new Date(x.created_at))}  ${formatSignedAmount(x.type, x.amount, x.currency)} ${escapeHtml(x.category ?? "")} ${escapeHtml(x.note ?? "")}`.trim(),
  );
  const paged = paginate(lines, page, HISTORY_PAGE_SIZE);
  const text = renderScreen({
    title: "История операций",
    lines: paged.items,
    emptyText: "Операций пока нет.",
  });
  const keyboard = paginationKeyboard("hist:page", paged.page, paged.totalPages, "menu:finance");
  return { text, keyboard };
}

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
  } catch (err) {
    logger.warn(`menuActions: editMessageText failed, falling back to reply: ${(err as Error).message}`);
    await ctx.reply(text, options);
  }
}

export function registerMenuActionHandlers(bot: Bot): void {
  bot.callbackQuery(
    /^action:(expense|income)$/,
    safeCallback("action:expense|income", async (ctx) => {
      const type = ctx.match[1] === "expense" ? "expense" : "income";
      const uid = ctx.from.id;
      flows.set(uid, { type, stage: "amount" });
      await editOrReply(
        ctx,
        `Введи сумму ${type === "expense" ? "расхода" : "дохода"}, например: 25 GEL Еда обед\nМожно и в старом формате: -25 gel еда обед`,
        mainKeyboard,
      );
    }),
  );

  bot.callbackQuery(
    "action:budget",
    safeCallback("action:budget", async (ctx) => {
      await showBudget(ctx, ctx.from.id);
    }),
  );

  bot.callbackQuery(
    "action:stats",
    safeCallback("action:stats", async (ctx) => {
      await editOrReply(ctx, "Команда /stats покажет расходы по категориям. /export — выгрузка CSV.");
    }),
  );

  bot.callbackQuery(
    "action:history",
    safeCallback("action:history", async (ctx) => {
      const { text, keyboard } = await renderHistoryPage(ctx.from.id, 0);
      await editOrReply(ctx, text, keyboard, PARSE_MODE);
    }),
  );

  bot.callbackQuery(
    /^hist:page:(\d+)$/,
    safeCallback("hist:page", async (ctx) => {
      const { text, keyboard } = await renderHistoryPage(ctx.from.id, Number(ctx.match[1]));
      await editOrReply(ctx, text, keyboard, PARSE_MODE);
    }),
  );

  bot.callbackQuery(
    "action:payments",
    safeCallback("action:payments", async (ctx) => {
      const r = await pool.query(
        "SELECT id,title,amount,currency,due_day FROM recurring_payments WHERE user_id=$1 AND active ORDER BY due_day",
        [ctx.from.id],
      );
      const text = renderScreen({
        title: "Регулярные платежи",
        lines: r.rows.map(
          (x: any) =>
            `${x.id}. ${escapeHtml(x.title)} — ${formatMoney(x.amount, x.currency)}, день ${x.due_day}`,
        ),
        emptyText: "Регулярных платежей нет.",
      });
      await editOrReply(ctx, text, mainKeyboard, PARSE_MODE);
    }),
  );

  bot.callbackQuery(
    "action:goals",
    safeCallback("action:goals", async (ctx) => {
      const r = await pool.query(
        "SELECT id,title,saved_gel,target_gel FROM savings_goals WHERE user_id=$1 AND active ORDER BY id",
        [ctx.from.id],
      );
      const text = renderScreen({
        title: "Цели накопления",
        lines: r.rows.map(
          (x: any) =>
            `${x.id}. ${escapeHtml(x.title)} — ${formatMoney(x.saved_gel, "GEL")} / ${formatMoney(x.target_gel, "GEL")}`,
        ),
        emptyText: "Целей пока нет. Создать: /goal Название сумма\nПополнить: /save ID сумма",
      });
      await editOrReply(ctx, text, mainKeyboard, PARSE_MODE);
    }),
  );

  bot.callbackQuery(
    "action:rates",
    safeCallback("action:rates", async (ctx) => {
      await refreshRatesIfStale();
      const lines = getAllRateInfo().map((r) =>
        r.rateToGel === null
          ? `${r.currency} → курс недоступен`
          : `${r.currency} → ${r.rateToGel.toFixed(4)} GEL${r.isFallback ? " ⚠️ кеш" : ""}`,
      );
      await editOrReply(ctx, renderScreen({ title: "Курсы валют (NBG)", lines }), mainKeyboard, PARSE_MODE);
    }),
  );

  bot.callbackQuery(
    "action:help",
    safeCallback("action:help", async (ctx) => {
      await editOrReply(ctx, HELP);
    }),
  );

  bot.callbackQuery(
    "action:settings",
    safeCallback("action:settings", async (ctx) => {
      await editOrReply(
        ctx,
        "Настройки: валюта по умолчанию GEL. Доступные валюты: GEL, RUB, USD.\nКоманды: /category, /budget, /payment, /goal, /export",
      );
    }),
  );

  bot.callbackQuery(
    "action:restart",
    safeCallback("action:restart", async (ctx) => {
      const adminId = Number(process.env.ADMIN_TELEGRAM_ID);
      if (!Number.isInteger(adminId) || adminId <= 0 || ctx.from.id !== adminId) {
        await ctx.answerCallbackQuery({
          text: "Перезапуск доступен только администратору.",
          show_alert: true,
        });
        return;
      }
      await ctx.answerCallbackQuery({ text: "Перезапускаю..." });
      logger.info(`Restart requested by admin ${ctx.from.id}`);
      setTimeout(() => process.exit(75), 3000);
    }),
  );
}
