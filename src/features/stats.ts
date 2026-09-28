import { Bot, InlineKeyboard } from "grammy";
import { getExpenseCategoryTotals, getTransactionsByCategory } from "../db";
import { getUserSettings } from "../db/settings";
import { paginationKeyboard } from "../keyboards";
import { editOrReply } from "../editOrReply";
import { renderShareList, formatShareRow, ShareRow } from "../charts";
import { periodRange } from "../period";
import {
  escapeHtml,
  formatDateShort,
  formatPeriodLabel,
  formatSignedAmount,
  paginate,
  renderScreen,
  PARSE_MODE,
} from "../format";
import { safeCallback } from "../middleware/safe";

const DRILLDOWN_PAGE_SIZE = 10;

function statsKeyboard(offset: number, rows: ShareRow[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  rows.forEach((row, index) => {
    if (row.drillable)
      keyboard.text(`${row.label} (${row.percent}%)`, `stat_drill:${offset}:${index}:0`).row();
  });
  keyboard.text("◀", `stats:${offset - 1}`);
  if (offset < 0) keyboard.text("▶", `stats:${offset + 1}`);
  keyboard.row().text("⬅️ Главное меню", "menu:analytics");
  return keyboard;
}

export async function renderStatsScreen(userId: number, offset: number) {
  const settings = await getUserSettings(userId);
  const { from, to } = periodRange("month", offset, new Date(), settings.timezone);
  const totals = await getExpenseCategoryTotals(userId, from, to);
  const rows = renderShareList(totals);
  const text = renderScreen({
    title: `Структура расходов — ${formatPeriodLabel(from, to)}`,
    lines: rows.map(formatShareRow),
    emptyText: "За этот месяц расходов нет.",
  });
  return { text, keyboard: statsKeyboard(offset, rows) };
}

async function renderDrilldown(userId: number, offset: number, index: number, page: number) {
  const settings = await getUserSettings(userId);
  const { from, to } = periodRange("month", offset, new Date(), settings.timezone);
  const totals = await getExpenseCategoryTotals(userId, from, to);
  const target = totals[index];
  if (!target) return null;

  const txs = await getTransactionsByCategory(userId, target.category, from, to);
  const lines = txs.map((tx) => {
    const note = tx.note ? ` — ${escapeHtml(tx.note)}` : "";
    return `${formatDateShort(tx.created_at)}  ${formatSignedAmount(tx.type, tx.amount, tx.currency)}${note}`;
  });
  const paged = paginate(lines, page, DRILLDOWN_PAGE_SIZE);
  const label = target.category ? escapeHtml(target.category) : "Без категории";
  const text = renderScreen({
    title: `${label} — ${formatPeriodLabel(from, to)}`,
    lines: paged.items,
    emptyText: "Операций нет.",
  });
  const keyboard = paginationKeyboard(
    `stat_drill:${offset}:${index}`,
    paged.page,
    paged.totalPages,
    `stats:${offset}`,
  );
  return { text, keyboard };
}

export function registerStatsHandlers(bot: Bot): void {
  bot.callbackQuery(
    "action:stats",
    safeCallback("action:stats", async (ctx) => {
      const { text, keyboard } = await renderStatsScreen(ctx.from.id, 0);
      await editOrReply(ctx, text, { reply_markup: keyboard, parse_mode: PARSE_MODE });
    }),
  );

  bot.callbackQuery(
    /^stats:(-?\d+)$/,
    safeCallback("stats:period", async (ctx) => {
      const { text, keyboard } = await renderStatsScreen(ctx.from.id, Number(ctx.match[1]));
      await editOrReply(ctx, text, { reply_markup: keyboard, parse_mode: PARSE_MODE });
    }),
  );

  bot.callbackQuery(
    /^stat_drill:(-?\d+):(\d+):(\d+)$/,
    safeCallback("stat_drill", async (ctx) => {
      const offset = Number(ctx.match[1]);
      const index = Number(ctx.match[2]);
      const page = Number(ctx.match[3]);
      const result = await renderDrilldown(ctx.from.id, offset, index, page);
      if (!result) {
        await ctx.answerCallbackQuery({
          text: "Эта категория больше не в списке — данные могли измениться",
          show_alert: true,
        });
        return;
      }
      await editOrReply(ctx, result.text, { reply_markup: result.keyboard, parse_mode: PARSE_MODE });
    }),
  );
}
