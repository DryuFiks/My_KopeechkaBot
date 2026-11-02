// Pure month-by-month history: fills empty months and runs the balance forward (no DB, no I/O).

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** "YYYY-MM" key of a month, as produced by getMonthlyTotals and accepted by the history API. */
export type MonthKey = string;

export interface MonthTotals {
  month: MonthKey;
  incomeGel: number;
  expenseGel: number;
  operations: number;
}

export interface MonthRow extends MonthTotals {
  /** Balance carried in from all earlier months. */
  openingGel: number;
  /** openingGel + income − expense. */
  closingGel: number;
}

export function isMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function nextMonthKey(key: MonthKey): MonthKey {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Every month from the earliest one with data up to `currentMonth` (missing months are zeros),
 * newest first. With no data at all the current month alone is returned.
 */
export function buildMonthRows(totals: MonthTotals[], currentMonth: MonthKey): MonthRow[] {
  const byMonth = new Map(totals.map((t) => [t.month, t]));
  const first = totals.reduce<MonthKey>((min, t) => (t.month < min ? t.month : min), currentMonth);
  const rows: MonthRow[] = [];
  let balance = 0;
  for (let key = first; key <= currentMonth; key = nextMonthKey(key)) {
    const t = byMonth.get(key) ?? { month: key, incomeGel: 0, expenseGel: 0, operations: 0 };
    const closingGel = round2(balance + t.incomeGel - t.expenseGel);
    rows.push({ ...t, openingGel: round2(balance), closingGel });
    balance = closingGel;
  }
  return rows.reverse();
}
