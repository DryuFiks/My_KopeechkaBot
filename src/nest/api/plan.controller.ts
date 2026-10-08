import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { convertToGel, getRateInfo } from "../../currency";
import { effectiveRateToGel } from "../../currencies";
import { getSummaryForRange } from "../../db";
import { listDebts } from "../../db/debts";
import {
  createIncomeSource,
  createPlannedExpense,
  deleteIncomeSource,
  deletePlannedExpense,
  listIncomeSources,
  listPlannedExpenses,
  listReceipts,
  upsertReceipt,
  type IncomeSource,
} from "../../db/plan";
import { setBudgetLimit } from "../../db/budget";
import { getUserSettings } from "../../db/settings";
import {
  daysLeftInMonth,
  expectedMonthlyAmount,
  freeMoney,
  suggestCategoryLimits,
  suggestGoalTemplates,
  todayAllowance,
} from "../../monthPlan";
import { totalMinimums } from "../../debtPayoff";
import { zonedMonthBoundaries } from "../../timezone";
import type { SupportedCurrency } from "../../currencies";
import type { WebAppUser } from "../../telegramAuth";
import { TelegramAuthGuard, WebUser } from "./auth.guard";
import { currency, money, name, optionalDay } from "./validation";

const round2 = (v: number): number => Math.round(v * 100) / 100;

async function monthContext(userId: number) {
  const settings = await getUserSettings(userId);
  const now = new Date();
  const month = zonedMonthBoundaries(now, settings.timezone);
  return { settings, now, month };
}

/** GEL value of one unit of the user's main currency at their exchanger rate; null if the rate is unknown. */
function displayRateGel(cur: SupportedCurrency, factor: number): number | null {
  if (cur === "GEL") return 1;
  const official = getRateInfo(cur).rateToGel;
  return official === null ? null : effectiveRateToGel(official, cur, factor);
}

@Controller("api/plan")
@UseGuards(TelegramAuthGuard)
export class PlanController {
  /** Raw plan: income sources with their expected amount this month, and mandatory expenses. */
  @Get()
  async plan(@WebUser() user: WebAppUser) {
    const { settings, month } = await monthContext(user.id);
    const [sources, expenses, receipts] = await Promise.all([
      listIncomeSources(user.id),
      listPlannedExpenses(user.id),
      listReceipts(user.id, month.from),
    ]);
    const incomes = sources.map((s) => {
      const mine = receipts.filter((r) => r.sourceId === s.id);
      const current = mine.find((r) => r.isCurrentMonth);
      const previous = mine.filter((r) => !r.isCurrentMonth).map((r) => r.amount);
      const receivedThisMonth = current ? current.amount : null;
      return {
        ...s,
        receivedThisMonth,
        expectedAmount: expectedMonthlyAmount(s, receivedThisMonth, previous),
      };
    });
    return {
      displayCurrency: settings.displayCurrency,
      exchangeFactor: settings.exchangeFactor,
      onboarded: settings.onboardedAt !== null,
      incomes,
      expenses,
    };
  }

  @Post("income")
  async addIncome(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    const mode = body.mode;
    if (mode !== "fixed" && mode !== "range" && mode !== "actual")
      throw new BadRequestException("invalid mode");
    const source: Omit<IncomeSource, "id"> = {
      name: name(body.name),
      mode,
      amount: mode === "fixed" ? money(body.amount) : null,
      minAmount: mode === "range" ? money(body.minAmount) : null,
      maxAmount: mode === "range" ? money(body.maxAmount) : null,
      currency: currency(body.currency),
      payDay: optionalDay(body.payDay),
    };
    return createIncomeSource(user.id, source);
  }

  @Delete("income/:id")
  async removeIncome(@WebUser() user: WebAppUser, @Param("id", ParseIntPipe) id: number) {
    return { deleted: await deleteIncomeSource(user.id, id) };
  }

  /** "Сколько получил в этот раз" — отметка фактического дохода за текущий месяц. */
  @Put("income/:id/receipt")
  async markReceived(
    @WebUser() user: WebAppUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    const { month } = await monthContext(user.id);
    const ok = await upsertReceipt(user.id, id, month.from, money(body.amount));
    if (!ok) throw new NotFoundException();
    return { ok: true };
  }

  @Post("expense")
  async addExpense(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    return createPlannedExpense(user.id, {
      name: name(body.name),
      amount: money(body.amount),
      currency: currency(body.currency),
      dueDay: optionalDay(body.dueDay),
    });
  }

  @Delete("expense/:id")
  async removeExpense(@WebUser() user: WebAppUser, @Param("id", ParseIntPipe) id: number) {
    return { deleted: await deletePlannedExpense(user.id, id) };
  }

  /** The headline numbers: free money per month, per day, and what can be spent today. */
  @Get("summary")
  async summary(@WebUser() user: WebAppUser) {
    const plan = await this.plan(user);
    const { settings, now, month } = await monthContext(user.id);
    const [debts, spent] = await Promise.all([
      listDebts(user.id),
      getSummaryForRange(user.id, month.from, month.to),
    ]);

    let ratesMissing = false;
    const toGel = (amount: number, cur: Parameters<typeof convertToGel>[1]): number => {
      const gel = convertToGel(amount, cur, settings.exchangeFactor);
      if (gel === null) {
        ratesMissing = true;
        return 0;
      }
      return gel;
    };

    const incomeGel = round2(plan.incomes.reduce((s, i) => s + toGel(i.expectedAmount, i.currency), 0));
    const plannedGel = plan.expenses.reduce((s, e) => s + toGel(e.amount, e.currency), 0);
    const debtMinimumsGel = totalMinimums(debts);
    const mandatoryGel = round2(plannedGel + debtMinimumsGel);
    const freeMonthGel = freeMoney(incomeGel, mandatoryGel);

    const daysInMonth = Math.round((month.to.getTime() - month.from.getTime()) / 86_400_000);
    const daysLeft = daysLeftInMonth(now, settings.timezone);
    const today = todayAllowance({
      incomeGel,
      mandatoryGel,
      expenseSoFarGel: spent.expense_gel,
      daysLeft,
      daysInMonth,
    });

    return {
      displayCurrency: settings.displayCurrency,
      exchangeFactor: settings.exchangeFactor,
      incomeGel,
      mandatoryGel,
      debtMinimumsGel,
      freeMonthGel,
      plannedPerDayGel: freeMonthGel > 0 ? round2(freeMonthGel / daysInMonth) : 0,
      daysLeft,
      today,
      ratesMissing,
      displayRateGel: displayRateGel(settings.displayCurrency, settings.exchangeFactor),
      goalTemplates: suggestGoalTemplates(mandatoryGel, freeMonthGel),
      categoryLimits: suggestCategoryLimits(freeMonthGel),
    };
  }

  /** Applies the (user-edited) suggested limits to the current month. */
  @Post("apply-budget")
  async applyBudget(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    const limits = body.limits;
    if (!Array.isArray(limits) || limits.length === 0 || limits.length > 20) {
      throw new BadRequestException("invalid limits");
    }
    const { month } = await monthContext(user.id);
    // Validate everything before writing anything, so a bad row never leaves a half-applied budget.
    const parsed = limits.map((l: Record<string, unknown>) => ({
      category: name(l?.category),
      limitGel: money(l?.limitGel, { allowZero: false }),
    }));
    for (const l of parsed) await setBudgetLimit(user.id, month.from, l.category, l.limitGel);
    return { applied: parsed.length };
  }
}
