import { Bot } from "grammy";
import { getSummaryForRange } from "../db";
import { getBudgetRemainingForRange } from "../db/budget";
import { periodSwitchKeyboard } from "../keyboards/period";
import { editOrReply } from "../editOrReply";
import {
  formatDateShort,
  formatDelta,
  formatMoney,
  formatPercentDelta,
  formatPeriodLabel,
  renderScreen,
  PARSE_MODE,
} from "../format";
import { periodRange, previousPeriodRange, PeriodUnit } from "../period";
import { safeCallback } from "../middleware/safe";

function isPeriodUnit(value: string): value is PeriodUnit {
  return value === "month" || value === "quarter" || value === "year";
}

async function renderDashboard(userId: number, unit: PeriodUnit, offset: number) {
  const { from, to } = periodRange(unit, offset);
  const prev = previousPeriodRange(unit, offset);

  const [current, previous, budgetRemaining] = await Promise.all([
    getSummaryForRange(userId, from, to),
    getSummaryForRange(userId, prev.from, prev.to),
    getBudgetRemainingForRange(userId, from, to),
  ]);

  const netFlow = current.income_gel - current.expense_gel;
  const prevNetFlow = previous.income_gel - previous.expense_gel;

  const lines = [
    `Доходы: ${formatMoney(current.income_gel, "GEL")} (${formatDelta(current.income_gel - previous.income_gel, "GEL")}, ${formatPercentDelta(current.income_gel, previous.income_gel)} к пред. периоду)`,
    `Расходы: ${formatMoney(current.expense_gel, "GEL")} (${formatDelta(current.expense_gel - previous.expense_gel, "GEL")}, ${formatPercentDelta(current.expense_gel, previous.expense_gel)})`,
    `Чистый поток: ${formatMoney(netFlow, "GEL")} (${formatDelta(netFlow - prevNetFlow, "GEL")}, ${formatPercentDelta(netFlow, prevNetFlow)})`,
    budgetRemaining === null
      ? "Остаток бюджета: лимиты не заданы"
      : `Остаток бюджета: ${formatMoney(budgetRemaining, "GEL")}`,
  ];
  if (current.unconverted_count > 0) {
    lines.push(`⚠️ ${current.unconverted_count} операц. без курса — не учтены в суммах`);
  }
  lines.push("", `Обновлено: ${formatDateShort(new Date())}`);

  const text = renderScreen({ title: `Дашборд — ${formatPeriodLabel(from, to)}`, lines });
  const keyboard = periodSwitchKeyboard("dash", unit, offset, "menu:analytics");
  return { text, keyboard };
}

export function registerDashboardHandlers(bot: Bot): void {
  bot.callbackQuery(
    "action:dashboard",
    safeCallback("action:dashboard", async (ctx) => {
      const { text, keyboard } = await renderDashboard(ctx.from.id, "month", 0);
      await editOrReply(ctx, text, { reply_markup: keyboard, parse_mode: PARSE_MODE });
    }),
  );

  bot.callbackQuery(
    /^dash:(month|quarter|year):(-?\d+)$/,
    safeCallback("dash:period", async (ctx) => {
      const unit = ctx.match[1];
      if (!isPeriodUnit(unit)) {
        await ctx.answerCallbackQuery({ text: "Неизвестный период", show_alert: true });
        return;
      }
      const { text, keyboard } = await renderDashboard(ctx.from.id, unit, Number(ctx.match[2]));
      await editOrReply(ctx, text, { reply_markup: keyboard, parse_mode: PARSE_MODE });
    }),
  );
}
