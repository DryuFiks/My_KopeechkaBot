import { BadRequestException, Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import {
  getBalanceBefore,
  getExpenseCategoryTotals,
  getExpenseSeries,
  getMonthlyTotals,
  getSummaryForRange,
  getTransactionsForRange,
} from "../../db";
import { getUserSettings } from "../../db/settings";
import { buildMonthRows, isMonthKey } from "../../historyMonths";
import { zonedDayBoundaries, zonedMonthBoundaries } from "../../timezone";
import type { WebAppUser } from "../../telegramAuth";
import { TelegramAuthGuard, WebUser } from "./auth.guard";
import { presentTransaction } from "./transactionView";

const DAY_MS = 86_400_000;
const PAGE_MAX = 100;
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Bounds of a "YYYY-MM" month in the user's timezone; a noon-UTC mid-month date is safe for any offset. */
function monthBounds(key: string, timeZone: string) {
  if (!isMonthKey(key)) throw new BadRequestException("invalid month");
  const [y, m] = key.split("-").map(Number);
  return zonedMonthBoundaries(new Date(Date.UTC(y, m - 1, 15, 12)), timeZone);
}

function intParam(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new BadRequestException("invalid paging");
  return n;
}

@Controller("api/history")
@UseGuards(TelegramAuthGuard)
export class HistoryController {
  /** Every month from the first operation to now with income, expense and the balance carried through. */
  @Get()
  async months(@WebUser() user: WebAppUser) {
    const { timezone } = await getUserSettings(user.id);
    const totals = await getMonthlyTotals(user.id, timezone);
    const { from } = zonedMonthBoundaries(new Date(), timezone);
    const current = `${from.toLocaleDateString("en-CA", { timeZone: timezone }).slice(0, 7)}`;
    return { months: buildMonthRows(totals, current) };
  }

  /** One month in detail: totals, balance in/out, spending by category and by day. */
  @Get(":month")
  async month(@WebUser() user: WebAppUser, @Param("month") key: string) {
    const { timezone } = await getUserSettings(user.id);
    const { from, to } = monthBounds(key, timezone);
    // For the running month the chart stops at the end of today instead of showing empty future days.
    const seriesTo = new Date(Math.min(to.getTime(), zonedDayBoundaries(new Date(), timezone).to.getTime()));
    const [summary, openingGel, categories, daily] = await Promise.all([
      getSummaryForRange(user.id, from, to),
      getBalanceBefore(user.id, from),
      getExpenseCategoryTotals(user.id, from, to),
      seriesTo > from ? getExpenseSeries(user.id, from, seriesTo, "day", timezone) : Promise.resolve([]),
    ]);
    return {
      month: key,
      incomeGel: summary.income_gel,
      expenseGel: summary.expense_gel,
      openingGel,
      closingGel: round2(openingGel + summary.income_gel - summary.expense_gel),
      daysInMonth: Math.round((to.getTime() - from.getTime()) / DAY_MS),
      categories,
      daily: daily.map((d) => d.amountGel),
    };
  }

  @Get(":month/transactions")
  async transactions(
    @WebUser() user: WebAppUser,
    @Param("month") key: string,
    @Query("offset") offset?: string,
    @Query("limit") limit?: string,
  ) {
    const { timezone } = await getUserSettings(user.id);
    const { from, to } = monthBounds(key, timezone);
    const pageSize = Math.max(1, intParam(limit, 30, PAGE_MAX));
    // One extra row tells the client whether another page exists.
    const rows = await getTransactionsForRange(user.id, from, to, pageSize + 1, intParam(offset, 0, 1e6));
    return {
      hasMore: rows.length > pageSize,
      items: rows.slice(0, pageSize).map(presentTransaction),
    };
  }
}
