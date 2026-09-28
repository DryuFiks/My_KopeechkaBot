import { Bot } from "grammy";
import { pool, getSummaryForRange } from "../db";
import { getUserSettings } from "../db/settings";
import { mainKeyboard, paginationKeyboard } from "../keyboards";
import { refreshRatesIfStale, getAllRateInfo } from "../currency";
import { zonedMonthBoundaries } from "../timezone";
import { flows, showBudget } from "../features/common";
import { editOrReply } from "../editOrReply";
import { logger } from "../logger";
import {
  escapeHtml,
  formatDateShort,
  formatMoney,
  formatPeriodLabel,
  formatSignedAmount,
  paginate,
  renderScreen,
  PARSE_MODE,
} from "../format";
import { suggestBudgetSplit } from "../budgetRules";
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

export function registerMenuActionHandlers(bot: Bot): void {
  bot.callbackQuery(
    /^action:(expense|income)$/,
    safeCallback("action:expense|income", async (ctx) => {
      const type = ctx.match[1] === "expense" ? "expense" : "income";
      const uid = ctx.from.id;
      flows.set(uid, { type, stage: "amount" });
      await editOrReply(
        ctx,
        `Введи сумму ${type === "expense" ? "расхода" : "дохода"}, например: 25 GEL Еда обед\nИли только сумму — предложу выбрать категорию: 25 GEL`,
        { reply_markup: mainKeyboard },
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
    "action:budget_template",
    safeCallback("action:budget_template", async (ctx) => {
      const settings = await getUserSettings(ctx.from.id);
      const { from, to } = zonedMonthBoundaries(new Date(), settings.timezone);
      const summary = await getSummaryForRange(ctx.from.id, from, to);
      const split = suggestBudgetSplit(summary.income_gel);
      const text = renderScreen({
        title: `Шаблон бюджета (50/30/20) — ${formatPeriodLabel(from, to)}`,
        lines:
          summary.income_gel > 0
            ? [
                `На основе дохода за месяц: ${formatMoney(summary.income_gel, "GEL")}`,
                "",
                `Обязательные расходы (50%): ${formatMoney(split.essentialsGel, "GEL")}`,
                `Повседневные траты (30%): ${formatMoney(split.discretionaryGel, "GEL")}`,
                `Накопления (20%): ${formatMoney(split.savingsGel, "GEL")}`,
                "",
                "Это лишь подсказка — задай свои лимиты через /budget Категория сумма.",
              ]
            : [],
        emptyText:
          "За этот месяц ещё нет дохода, чтобы предложить шаблон. Как только запишешь доход, здесь появится подсказка по 50/30/20 — не обязательное правило, а просто отправная точка.",
      });
      await editOrReply(ctx, text, { reply_markup: mainKeyboard, parse_mode: PARSE_MODE });
    }),
  );

  bot.callbackQuery(
    "action:history",
    safeCallback("action:history", async (ctx) => {
      const { text, keyboard } = await renderHistoryPage(ctx.from.id, 0);
      await editOrReply(ctx, text, { reply_markup: keyboard, parse_mode: PARSE_MODE });
    }),
  );

  bot.callbackQuery(
    /^hist:page:(\d+)$/,
    safeCallback("hist:page", async (ctx) => {
      const { text, keyboard } = await renderHistoryPage(ctx.from.id, Number(ctx.match[1]));
      await editOrReply(ctx, text, { reply_markup: keyboard, parse_mode: PARSE_MODE });
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
      await editOrReply(ctx, renderScreen({ title: "Курсы валют (NBG)", lines }), {
        reply_markup: mainKeyboard,
        parse_mode: PARSE_MODE,
      });
    }),
  );

  bot.callbackQuery(
    "action:help",
    safeCallback("action:help", async (ctx) => {
      await editOrReply(ctx, HELP, { reply_markup: mainKeyboard });
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
