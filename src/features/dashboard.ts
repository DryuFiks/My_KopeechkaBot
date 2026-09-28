import { Bot } from "grammy";
import { getSummaryForRange } from "../db";
import { getBudgetRemainingForRange } from "../db/budget";
import { getUserSettings } from "../db/settings";
import { toDisplayCurrency } from "../displayCurrency";
import type { SupportedCurrency } from "../currencies";
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

function formatKpiLine(
  label: string,
  currentGel: number,
  previousGel: number,
  displayCurrency: SupportedCurrency,
  suffix = "",
): { line: string; fallback: boolean } {
  const current = toDisplayCurrency(currentGel, displayCurrency);
  const delta = toDisplayCurrency(currentGel - previousGel, displayCurrency);
  const line = `${label}: ${formatMoney(current.amount, current.currency)} (${formatDelta(delta.amount, delta.currency)}, ${formatPercentDelta(currentGel, previousGel)}${suffix})`;
  return { line, fallback: !current.ok || !delta.ok };
}

async function renderDashboard(userId: number, unit: PeriodUnit, offset: number) {
  const settings = await getUserSettings(userId);
  const now = new Date();
  const { from, to } = periodRange(unit, offset, now, settings.timezone);
  const prev = previousPeriodRange(unit, offset, now, settings.timezone);

  const [current, previous, budgetRemaining] = await Promise.all([
    getSummaryForRange(userId, from, to),
    getSummaryForRange(userId, prev.from, prev.to),
    getBudgetRemainingForRange(userId, from, to),
  ]);

  const netFlow = current.income_gel - current.expense_gel;
  const prevNetFlow = previous.income_gel - previous.expense_gel;
  const dc = settings.displayCurrency;

  const incomeKpi = formatKpiLine("Доходы", current.income_gel, previous.income_gel, dc, " к пред. периоду");
  const expenseKpi = formatKpiLine("Расходы", current.expense_gel, previous.expense_gel, dc);
  const netKpi = formatKpiLine("Чистый поток", netFlow, prevNetFlow, dc);
  const budgetDisp = budgetRemaining === null ? null : toDisplayCurrency(budgetRemaining, dc);

  const lines = [
    incomeKpi.line,
    expenseKpi.line,
    netKpi.line,
    budgetDisp === null
      ? "Остаток бюджета: лимиты не заданы"
      : `Остаток бюджета: ${formatMoney(budgetDisp.amount, budgetDisp.currency)}`,
  ];
  const rateFallback =
    incomeKpi.fallback || expenseKpi.fallback || netKpi.fallback || budgetDisp?.ok === false;
  if (rateFallback) {
    lines.push(`⚠️ Курс для отображения в ${dc} недоступен — суммы показаны в GEL`);
  }
  if (current.unconverted_count > 0) {
    lines.push(`⚠️ ${current.unconverted_count} операц. без курса — не учтены в суммах`);
  }
  lines.push("", `Обновлено: ${formatDateShort(now)}`);

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
