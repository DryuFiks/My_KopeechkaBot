import { Controller, Get, UseGuards } from "@nestjs/common";
import { getSummaryForRange } from "../../db";
import { getBudgetReport } from "../../db/budget";
import { listGoals } from "../../db/goals";
import { getUserSettings } from "../../db/settings";
import { zonedMonthBoundaries } from "../../timezone";
import { TelegramAuthGuard, WebUser } from "./auth.guard";
import type { WebAppUser } from "../../telegramAuth";

const DAY_MS = 86_400_000;

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

  @Get("budget")
  async budget(@WebUser() user: WebAppUser) {
    const settings = await getUserSettings(user.id);
    const { from, to } = zonedMonthBoundaries(new Date(), settings.timezone);
    const [s, categories] = await Promise.all([
      getSummaryForRange(user.id, from, to),
      getBudgetReport(user.id, from, to),
    ]);
    return { incomeGel: s.income_gel, categories };
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
