// Pure rules for editing a recorded operation (MKB-053) — no DB, testable as is.
// The I/O shell is PUT /api/transactions/:id (nest/api/transactions.controller.ts).

import type { SupportedCurrency } from "./currencies";

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * GEL value after an edit. Same currency: keep the rate the operation was recorded at (stored
 * amount_gel is a historical fact), only the amount scales. Another currency: today's rate, as for
 * a new operation. No rate available → null, never an invented number.
 */
export function recomputeAmountGel(params: {
  oldAmount: number;
  oldCurrency: SupportedCurrency;
  oldAmountGel: number | null;
  newAmount: number;
  newCurrency: SupportedCurrency;
  /** GEL for newAmount at today's (exchanger) rate, or null if the rate is unknown. */
  todayGel: number | null;
}): number | null {
  const { oldAmount, oldCurrency, oldAmountGel, newAmount, newCurrency, todayGel } = params;
  if (newCurrency === "GEL") return round2(newAmount);
  if (newCurrency === oldCurrency && oldAmountGel !== null && oldAmount > 0) {
    return round2((oldAmountGel / oldAmount) * newAmount);
  }
  return todayGel;
}

/**
 * The calendar day picked in the editor → the operation's new time: noon of that day in the user's
 * timezone (dayStart is that day's local midnight). Days in the future or more than 5 years back are
 * rejected; null means the date is invalid.
 */
export function editedOperationTime(dayStart: Date, todayStart: Date): Date | null {
  const FIVE_YEARS_MS = 5 * 366 * 86_400_000;
  if (dayStart.getTime() > todayStart.getTime()) return null;
  if (todayStart.getTime() - dayStart.getTime() > FIVE_YEARS_MS) return null;
  return new Date(dayStart.getTime() + 12 * 3_600_000);
}

/** "YYYY-MM-DD" → parts, or null when it isn't a real calendar date. */
export function parseIsoDate(value: unknown): { year: number; month: number; day: number } | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day)
    return null;
  return { year, month, day };
}
