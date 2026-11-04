// Pure predicate behind the payment reminder scheduler (reminders.ts) — kept in its own
// dependency-free module so it's testable without a DATABASE_URL, the same reason
// parser.ts/currencies.ts were split out from their DB-touching siblings.

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The day a payment falls on in a given month: its day, or the month's last day when the month is shorter. */
export function dueDayInMonth(dueDay: number, year: number, month: number): number {
  return Math.min(dueDay, daysInMonth(year, month));
}

/**
 * Is this payment due today, and has it not already been notified today?
 * `todayIso`/`lastNotifiedIso` are "YYYY-MM-DD" strings — comparing them as strings
 * (not Date objects) keeps this free of any timezone assumptions of its own; the caller
 * is responsible for resolving "today" in the payment owner's own timezone first.
 * A day-31 payment is due on the 30th in a 30-day month and on 28/29 February (MKB-059 fix:
 * before, such payments were silently never reminded in shorter months).
 */
export function isPaymentDueToday(dueDay: number, todayIso: string, lastNotifiedIso: string | null): boolean {
  const [year, month, day] = todayIso.split("-").map(Number);
  if (day !== dueDayInMonth(dueDay, year, month)) return false;
  return lastNotifiedIso !== todayIso;
}

/**
 * MKB-059: the next date a payment is due, today included, as "YYYY-MM-DD", and days until it.
 * `today` is the user's local calendar date.
 */
export function nextDueDate(
  dueDay: number,
  today: { year: number; month: number; day: number },
): { iso: string; inDays: number } {
  let { year, month } = today;
  let day = dueDayInMonth(dueDay, year, month);
  if (day < today.day) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    day = dueDayInMonth(dueDay, year, month);
  }
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const inDays = Math.round(
    (Date.UTC(year, month - 1, day) - Date.UTC(today.year, today.month - 1, today.day)) / 86_400_000,
  );
  return { iso, inDays };
}
