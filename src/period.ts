// Pure period-range math for the dashboard (MKB-009) — no I/O, easy to test in isolation.

export type PeriodUnit = "month" | "quarter" | "year";

export interface PeriodRange {
  from: Date;
  to: Date;
}

/** offset 0 = the current period, -1 = the one before it, +1 = the next one (not shown in the UI). */
export function periodRange(unit: PeriodUnit, offset: number, now = new Date()): PeriodRange {
  if (unit === "month") {
    const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
    return { from, to };
  }
  if (unit === "quarter") {
    const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const from = new Date(now.getFullYear(), currentQuarterStartMonth + offset * 3, 1);
    const to = new Date(now.getFullYear(), currentQuarterStartMonth + offset * 3 + 3, 1);
    return { from, to };
  }
  const from = new Date(now.getFullYear() + offset, 0, 1);
  const to = new Date(now.getFullYear() + offset + 1, 0, 1);
  return { from, to };
}

/** The immediately preceding period of the same length, for period-over-period comparison. */
export function previousPeriodRange(unit: PeriodUnit, offset: number, now = new Date()): PeriodRange {
  return periodRange(unit, offset - 1, now);
}
