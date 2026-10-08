// Pure "plan of the month" logic for the WebApp onboarding (no DB, no I/O).
// Everything here works in a single currency (GEL) — callers convert first. The numbers are
// estimates that help the user plan; they never feed back into stored transactions.

import { zonedDayBoundaries, zonedMonthBoundaries } from "./timezone";

const DAY_MS = 86_400_000;
const round2 = (v: number): number => Math.round(v * 100) / 100;

export type IncomeMode = "fixed" | "range" | "actual";

export interface IncomeSourceInput {
  mode: IncomeMode;
  amount: number | null;
  minAmount: number | null;
  maxAmount: number | null;
}

/**
 * Expected income of one source for a month, in the source's own currency.
 * - fixed: the amount;
 * - range: the average of min and max (so an uncertain income is planned at the middle);
 * - actual: what was really received this month if marked, otherwise the average of up to
 *   three previous months, otherwise 0 (nothing to base a plan on yet).
 */
export function expectedMonthlyAmount(
  source: IncomeSourceInput,
  receivedThisMonth: number | null,
  previousMonths: number[],
): number {
  if (source.mode === "fixed") return round2(source.amount ?? 0);
  if (source.mode === "range") {
    const lo = source.minAmount ?? 0;
    const hi = source.maxAmount ?? lo;
    return round2((Math.min(lo, hi) + Math.max(lo, hi)) / 2);
  }
  if (receivedThisMonth !== null) return round2(receivedThisMonth);
  const recent = previousMonths.slice(0, 3);
  if (recent.length === 0) return 0;
  return round2(recent.reduce((s, v) => s + v, 0) / recent.length);
}

/** Whole days left in the user's current month, today included (never below 1). */
export function daysLeftInMonth(now: Date, timeZone: string): number {
  const month = zonedMonthBoundaries(now, timeZone);
  const today = zonedDayBoundaries(now, timeZone);
  return Math.max(1, Math.round((month.to.getTime() - today.from.getTime()) / DAY_MS));
}

export function freeMoney(incomeGel: number, mandatoryGel: number): number {
  return round2(incomeGel - mandatoryGel);
}

export type AllowanceStatus = "ok" | "tight" | "over";

export interface TodayAllowance {
  /** What is left for the rest of the month after mandatory payments and optional spending so far. */
  remainingGel: number;
  /** remaining / days left; 0 when nothing is left. */
  perDayGel: number;
  status: AllowanceStatus;
}

/**
 * How much can be spent per day for the rest of the month.
 * remaining = income − max(mandatory, spent so far): until spending passes the mandatory
 * total we assume mandatory payments are still ahead (they are reserved), and once it does
 * every extra lari is counted as optional spending. Status "tight" means the allowance is
 * under half of the originally planned daily amount.
 */
export function todayAllowance(params: {
  incomeGel: number;
  mandatoryGel: number;
  expenseSoFarGel: number;
  daysLeft: number;
  daysInMonth: number;
}): TodayAllowance {
  const { incomeGel, mandatoryGel, expenseSoFarGel, daysLeft, daysInMonth } = params;
  const remainingGel = round2(incomeGel - Math.max(mandatoryGel, expenseSoFarGel));
  const perDayGel = remainingGel > 0 ? round2(remainingGel / Math.max(1, daysLeft)) : 0;
  const plannedPerDay = Math.max(0, incomeGel - mandatoryGel) / Math.max(1, daysInMonth);
  const status: AllowanceStatus =
    remainingGel <= 0 ? "over" : perDayGel < plannedPerDay * 0.5 ? "tight" : "ok";
  return { remainingGel, perDayGel, status };
}

export interface GoalTemplate {
  code: "cushion" | "vacation" | "purchase";
  title: string;
  targetGel: number;
  monthlyGel: number;
  months: number;
}

const SAVINGS_SHARE = 0.2;

/** A monthly goal contribution: at most 20% of the free money, never negative. */
export function suggestMonthlyContribution(freeMonthGel: number): number {
  return freeMonthGel > 0 ? round2(freeMonthGel * SAVINGS_SHARE) : 0;
}

/** Starter goals sized from the user's own numbers: cushion = 3 months of mandatory expenses. */
export function suggestGoalTemplates(mandatoryGel: number, freeMonthGel: number): GoalTemplate[] {
  const monthly = suggestMonthlyContribution(freeMonthGel);
  const monthsFor = (target: number): number => (monthly > 0 ? Math.ceil(target / monthly) : 0);
  const cushionTarget = round2(mandatoryGel * 3);
  return [
    {
      code: "cushion",
      title: "Подушка безопасности",
      targetGel: cushionTarget,
      monthlyGel: monthly,
      months: monthsFor(cushionTarget),
    },
    {
      code: "vacation",
      title: "Отпуск",
      targetGel: round2(monthly * 6),
      monthlyGel: monthly,
      months: monthly > 0 ? 6 : 0,
    },
    {
      code: "purchase",
      title: "Крупная покупка",
      targetGel: round2(monthly * 12),
      monthlyGel: monthly,
      months: monthly > 0 ? 12 : 0,
    },
  ];
}

const CATEGORY_WEIGHTS: [string, number][] = [
  ["Еда", 0.45],
  ["Транспорт", 0.15],
  ["Развлечения", 0.15],
  ["Здоровье", 0.1],
  ["Прочее", 0.15],
];

/**
 * Starting limits for everyday spending: what remains of the free money after the savings
 * share, split by typical weights. A suggestion the user edits, never a rule.
 */
export function suggestCategoryLimits(freeMonthGel: number): { category: string; limitGel: number }[] {
  if (freeMonthGel <= 0) return [];
  const spendable = freeMonthGel * (1 - SAVINGS_SHARE);
  return CATEGORY_WEIGHTS.map(([category, weight]) => ({ category, limitGel: round2(spendable * weight) }));
}
