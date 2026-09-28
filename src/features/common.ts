import { Context } from "grammy";
import { getBudgetReport } from "../db/budget";
import { getUserSettings } from "../db/settings";
import { mainKeyboard } from "../keyboards";
import {
  formatBudgetCategoryLine,
  formatMoney,
  formatPeriodLabel,
  renderScreen,
  PARSE_MODE,
} from "../format";
import { renderBarRow } from "../charts";
import { zonedMonthBoundaries } from "../timezone";
import { CATEGORY_KIND_LABEL, CATEGORY_KIND_ORDER } from "../budgetRules";
import type { BudgetCategoryReport } from "../db/budget";
import type { TransactionType } from "../parser";

export type Flow = {
  type: TransactionType;
  amount?: number;
  currency?: "RUB" | "GEL" | "USD";
  category?: string | null;
  note?: string | null;
  stage: "amount" | "category" | "confirm";
  /** Categories shown at the "category" stage, so cat:<index> callbacks can resolve them. */
  categoryOptions?: string[];
};

export const flows = new Map<number, Flow>();
export const monthStart = (timeZone = "Asia/Tbilisi") => zonedMonthBoundaries(new Date(), timeZone).from;

/** Bar + the exact plan/fact/deviation line underneath it — the bar alone is never the only source of truth. */
function formatBudgetRowWithBar(row: BudgetCategoryReport): string[] {
  const label = row.category ?? "Без категории";
  return [renderBarRow(label, row.effectiveLimitGel ?? 0, row.spentGel), formatBudgetCategoryLine(row)];
}

export async function showBudget(ctx: Context, userId: number): Promise<void> {
  const settings = await getUserSettings(userId);
  const { from, to } = zonedMonthBoundaries(new Date(), settings.timezone);
  const report = await getBudgetReport(userId, from, to);

  const lines: string[] = [];
  for (const kind of CATEGORY_KIND_ORDER) {
    const rows = report.filter((row) => row.limitGel !== null && row.kind === kind);
    if (rows.length === 0) continue;
    lines.push(`<b>${CATEGORY_KIND_LABEL[kind]}</b>`, ...rows.flatMap(formatBudgetRowWithBar), "");
  }
  const noLimit = report.filter((row) => row.limitGel === null);
  if (noLimit.length > 0) {
    lines.push("<b>Без лимита</b>", ...noLimit.map(formatBudgetCategoryLine), "");
  }
  if (report.length > 0) {
    const totalPlan = report.reduce((sum, row) => sum + (row.effectiveLimitGel ?? 0), 0);
    const totalSpent = report.reduce((sum, row) => sum + row.spentGel, 0);
    lines.push(`Итого по плану: ${formatMoney(totalPlan, "GEL")}`);
    lines.push(`Итого потрачено: ${formatMoney(totalSpent, "GEL")}`);
    if (totalPlan > 0) {
      const diff = totalSpent - totalPlan;
      const sign = diff > 0 ? "+" : "";
      const percent = Math.round((diff / totalPlan) * 100);
      lines.push(`Отклонение: ${sign}${formatMoney(diff, "GEL")} (${sign}${percent}%)`);
    }
  }
  while (lines[lines.length - 1] === "") lines.pop();

  const text = renderScreen({
    title: `Бюджет — ${formatPeriodLabel(from, to)}`,
    lines,
    emptyText: "На этот месяц лимиты не заданы. Пришли: /budget Категория сумма (например: /budget Еда 500)",
  });
  await ctx.reply(text, { parse_mode: PARSE_MODE, reply_markup: mainKeyboard });
}
