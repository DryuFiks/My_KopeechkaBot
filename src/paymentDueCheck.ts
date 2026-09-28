// Pure predicate behind the payment reminder scheduler (reminders.ts) — kept in its own
// dependency-free module so it's testable without a DATABASE_URL, the same reason
// parser.ts/currencies.ts were split out from their DB-touching siblings.

/**
 * Is this payment due today, and has it not already been notified today?
 * `todayIso`/`lastNotifiedIso` are "YYYY-MM-DD" strings — comparing them as strings
 * (not Date objects) keeps this free of any timezone assumptions of its own; the caller
 * is responsible for resolving "today" in the payment owner's own timezone first.
 */
export function isPaymentDueToday(dueDay: number, todayIso: string, lastNotifiedIso: string | null): boolean {
  const todayDay = Number(todayIso.slice(8, 10));
  if (todayDay !== dueDay) return false;
  return lastNotifiedIso !== todayIso;
}
