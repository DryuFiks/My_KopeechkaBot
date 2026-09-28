// Period-range math for the dashboard/trend/stats screens (MKB-009/010), timezone-aware
// per user (MKB-013) — built on timezone.ts, no I/O, easy to test in isolation.

import { zonedDateBoundary, zonedToday } from "./timezone";

export type PeriodUnit = "month" | "quarter" | "year";

export interface PeriodRange {
  from: Date;
  to: Date;
}

const DEFAULT_TIME_ZONE = "Asia/Tbilisi";

/** offset 0 = the current period, -1 = the one before it, +1 = the next one (not shown in the UI). */
export function periodRange(
  unit: PeriodUnit,
  offset: number,
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
): PeriodRange {
  const today = zonedToday(timeZone, now);
  if (unit === "month") {
    const from = zonedDateBoundary(today.year, today.month + offset, 1, timeZone);
    const to = zonedDateBoundary(today.year, today.month + offset + 1, 1, timeZone);
    return { from, to };
  }
  if (unit === "quarter") {
    const quarterStartMonth = Math.floor((today.month - 1) / 3) * 3 + 1; // 1, 4, 7 or 10
    const from = zonedDateBoundary(today.year, quarterStartMonth + offset * 3, 1, timeZone);
    const to = zonedDateBoundary(today.year, quarterStartMonth + offset * 3 + 3, 1, timeZone);
    return { from, to };
  }
  const from = zonedDateBoundary(today.year + offset, 1, 1, timeZone);
  const to = zonedDateBoundary(today.year + offset + 1, 1, 1, timeZone);
  return { from, to };
}

/** The immediately preceding period of the same length, for period-over-period comparison. */
export function previousPeriodRange(
  unit: PeriodUnit,
  offset: number,
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
): PeriodRange {
  return periodRange(unit, offset - 1, now, timeZone);
}
