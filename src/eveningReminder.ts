// Pure rule for the evening reminder (MKB-057) — no DB, no bot. The scheduler is userReminders.ts.

/** Users who haven't opened the bot or recorded anything for this long don't get reminders. */
export const INACTIVE_AFTER_DAYS = 14;
export const DEFAULT_REMIND_HOUR = 21;
export const REMIND_HOURS = [18, 19, 20, 21, 22, 23];

const DAY_MS = 86_400_000;

/**
 * Remind tonight? Only when the user switched it on, it's their reminder hour or later, they haven't
 * been reminded today, nothing is recorded today ("no spending today" counts), and they were active
 * in the last two weeks — reminders must help, not nag people who left.
 */
export function isEveningReminderDue(p: {
  enabled: boolean;
  remindHour: number;
  localHour: number;
  todayIso: string;
  lastNotifiedIso: string | null;
  /** Start of today in the user's timezone. */
  dayStart: Date;
  /** Last operation or "no spending today" mark; null if none ever. */
  lastRecordAt: Date | null;
  /** Last activity of any kind (operation, app open, ...); null if none ever. */
  lastActiveAt: Date | null;
  now: Date;
}): boolean {
  if (!p.enabled || p.localHour < p.remindHour) return false;
  if (p.lastNotifiedIso === p.todayIso) return false;
  if (p.lastRecordAt && p.lastRecordAt.getTime() >= p.dayStart.getTime()) return false;
  if (!p.lastActiveAt || p.now.getTime() - p.lastActiveAt.getTime() > INACTIVE_AFTER_DAYS * DAY_MS)
    return false;
  return true;
}
