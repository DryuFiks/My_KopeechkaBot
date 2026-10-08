// Pure savings-goal forecasts for the WebApp (no DB, no I/O). Estimates only — they assume
// the recent saving pace simply continues.

const AVG_MONTH_DAYS = 30.4375;
const DAY_MS = 86_400_000;

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Whole months until `remainingGel` is saved at `monthlyGel` per month; null when the pace is zero. */
export function monthsToGoal(remainingGel: number, monthlyGel: number): number | null {
  if (remainingGel <= 0) return 0;
  if (!(monthlyGel > 0)) return null;
  return Math.ceil(remainingGel / monthlyGel);
}

export interface RequiredPace {
  monthsLeft: number;
  perMonthGel: number;
  /** The target date is today or already past, so no monthly pace can meet it. */
  overdue: boolean;
}

/** How much must be saved per month to hit `targetDate`; null for goals without a date. */
export function requiredMonthly(
  remainingGel: number,
  targetDate: Date | null,
  now: Date,
): RequiredPace | null {
  if (!targetDate) return null;
  if (remainingGel <= 0) return { monthsLeft: 0, perMonthGel: 0, overdue: false };
  const days = (targetDate.getTime() - now.getTime()) / DAY_MS;
  if (days <= 0) return { monthsLeft: 0, perMonthGel: round2(remainingGel), overdue: true };
  const monthsLeft = Math.max(1, Math.ceil(days / AVG_MONTH_DAYS));
  return { monthsLeft, perMonthGel: round2(remainingGel / monthsLeft), overdue: false };
}

/** Average monthly surplus over a window (income − expenses, never negative). */
export function averageMonthlySavings(incomeGel: number, expenseGel: number, windowMonths: number): number {
  if (windowMonths <= 0) return 0;
  return round2(Math.max(0, incomeGel - expenseGel) / windowMonths);
}
