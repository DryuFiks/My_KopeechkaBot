import { Bot } from "grammy";
import { getExpenseSeries, getSummaryForRange } from "../db";
import { periodSwitchKeyboard } from "../keyboards/period";
import { editOrReply } from "../editOrReply";
import { renderTrendLine } from "../charts";
import { periodRange, previousPeriodRange, PeriodUnit } from "../period";
import {
  formatDelta,
  formatMoney,
  formatPercentDelta,
  formatPeriodLabel,
  renderScreen,
  PARSE_MODE,
} from "../format";
import { safeCallback } from "../middleware/safe";

function isPeriodUnit(value: string): value is PeriodUnit {
  return value === "month" || value === "quarter" || value === "year";
}

async function renderTrend(userId: number, unit: PeriodUnit, offset: number) {
  const { from, to } = periodRange(unit, offset);
  const prev = previousPeriodRange(unit, offset);
  // A month is shown day-by-day; a quarter/year would be too many points at that
  // granularity, so those roll up to one point per month instead.
  const granularity = unit === "month" ? "day" : "month";

  const [series, current, previous] = await Promise.all([
    getExpenseSeries(userId, from, to, granularity),
    getSummaryForRange(userId, from, to),
    getSummaryForRange(userId, prev.from, prev.to),
  ]);

  const points = series.map((point) => ({
    label: granularity === "day" ? String(point.bucket.getDate()) : String(point.bucket.getMonth() + 1),
    valueGel: point.amountGel,
  }));

  const lines = [
    renderTrendLine(points),
    "",
    `Расходы за период: ${formatMoney(current.expense_gel, "GEL")}`,
    `К предыдущему периоду: ${formatDelta(current.expense_gel - previous.expense_gel, "GEL")} (${formatPercentDelta(current.expense_gel, previous.expense_gel)})`,
  ];

  const text = renderScreen({ title: `Динамика расходов — ${formatPeriodLabel(from, to)}`, lines });
  const keyboard = periodSwitchKeyboard("trend", unit, offset, "menu:analytics");
  return { text, keyboard };
}

export function registerTrendHandlers(bot: Bot): void {
  bot.callbackQuery(
    "action:trend",
    safeCallback("action:trend", async (ctx) => {
      const { text, keyboard } = await renderTrend(ctx.from.id, "month", 0);
      await editOrReply(ctx, text, { reply_markup: keyboard, parse_mode: PARSE_MODE });
    }),
  );

  bot.callbackQuery(
    /^trend:(month|quarter|year):(-?\d+)$/,
    safeCallback("trend:period", async (ctx) => {
      const unit = ctx.match[1];
      if (!isPeriodUnit(unit)) {
        await ctx.answerCallbackQuery({ text: "Неизвестный период", show_alert: true });
        return;
      }
      const { text, keyboard } = await renderTrend(ctx.from.id, unit, Number(ctx.match[2]));
      await editOrReply(ctx, text, { reply_markup: keyboard, parse_mode: PARSE_MODE });
    }),
  );
}
