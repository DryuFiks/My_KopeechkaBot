import { BadRequestException, Body, Controller, Delete, Get, Put, Query, UseGuards } from "@nestjs/common";
import { getExpenseSeries, getSummaryForRange } from "../../db";
import { deleteBudgetLimit, getBudgetReport, setBudgetLimit, setBudgetRollover } from "../../db/budget";
import { listGoals } from "../../db/goals";
import { getUserSettings } from "../../db/settings";
import { projectMonthSpending } from "../../budgetRules";
import { zonedDayBoundaries, zonedMonthBoundaries } from "../../timezone";
import { TelegramAuthGuard, WebUser } from "./auth.guard";
import type { WebAppUser } from "../../telegramAuth";

const DAY_MS = 86_400_000;

function category(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 60) throw new BadRequestException("invalid category");
  return name;
}

@Controller("api")
@UseGuards(TelegramAuthGuard)
export class FinanceController {
  @Get("overview")
  async overview(@WebUser() user: WebAppUser) {
    const settings = await getUserSettings(user.id);
    const { from, to } = zonedMonthBoundaries(new Date(), settings.timezone);
    const s = await getSummaryForRange(user.id, from, to);
    return { name: user.firstName, incomeGel: s.income_gel, expenseGel: s.expense_gel };
  }

  /** Plan vs fact for the current month, a per-day spending series for the chart and a month-end projection. */
  @Get("budget")
  async budget(@WebUser() user: WebAppUser) {
    const settings = await getUserSettings(user.id);
    const now = new Date();
    const { from, to } = zonedMonthBoundaries(now, settings.timezone);
    const untilEndOfToday = zonedDayBoundaries(now, settings.timezone).to;
    const [s, categories, daily] = await Promise.all([
      getSummaryForRange(user.id, from, to),
      getBudgetReport(user.id, from, to),
      getExpenseSeries(user.id, from, untilEndOfToday, "day", settings.timezone),
    ]);
    const daysInMonth = Math.round((to.getTime() - from.getTime()) / DAY_MS);
    return {
      incomeGel: s.income_gel,
      expenseGel: s.expense_gel,
      categories,
      daily: daily.map((d) => d.amountGel),
      daysInMonth,
      projectedExpenseGel: projectMonthSpending(s.expense_gel, daily.length, daysInMonth),
    };
  }

  @Put("budget/limit")
  async setLimit(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    const limit = Number(body.limitGel);
    if (!Number.isFinite(limit) || limit <= 0 || limit > 1e9) throw new BadRequestException("invalid limit");
    const settings = await getUserSettings(user.id);
    const { from } = zonedMonthBoundaries(new Date(), settings.timezone);
    await setBudgetLimit(user.id, from, category(body.category), Math.round(limit * 100) / 100);
    return { ok: true };
  }

  @Delete("budget/limit")
  async removeLimit(@WebUser() user: WebAppUser, @Query("category") name?: string) {
    const settings = await getUserSettings(user.id);
    const { from } = zonedMonthBoundaries(new Date(), settings.timezone);
    return { deleted: await deleteBudgetLimit(user.id, from, category(name)) };
  }

  @Put("budget/rollover")
  async setRollover(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    if (typeof body.enabled !== "boolean") throw new BadRequestException("invalid flag");
    const settings = await getUserSettings(user.id);
    const { from } = zonedMonthBoundaries(new Date(), settings.timezone);
    const updated = await setBudgetRollover(user.id, from, category(body.category), body.enabled);
    if (!updated) throw new BadRequestException("set a limit first");
    return { ok: true };
  }

  /** Savings = sum of active goals' saved amounts; expenses = average month over the last 90 days. */
  @Get("cushion")
  async cushion(@WebUser() user: WebAppUser) {
    const now = new Date();
    const [goals, s] = await Promise.all([
      listGoals(user.id),
      getSummaryForRange(user.id, new Date(now.getTime() - 90 * DAY_MS), now),
    ]);
    const savingsGel = goals.reduce((sum, g) => sum + Number(g.saved_gel), 0);
    return { savingsGel, avgMonthlyExpensesGel: Math.round((s.expense_gel / 3) * 100) / 100 };
  }
}
