import { pool } from "../db";
import { DEFAULT_EXCHANGE_FACTOR, type SupportedCurrency } from "../currencies";
import { DEFAULT_REMIND_HOUR } from "../eveningReminder";

export interface UserSettings {
  displayCurrency: SupportedCurrency;
  timezone: string;
  notifyPayments: boolean;
  /** Multiplier on official rates for foreign currency → GEL (exchanger spread); 1 = official. */
  exchangeFactor: number;
  onboardedAt: Date | null;
  /** MKB-057: evening "record your spending?" reminder — off unless the user turns it on. */
  remindEvening: boolean;
  remindHour: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  displayCurrency: "GEL",
  timezone: "Asia/Tbilisi",
  notifyPayments: true,
  exchangeFactor: DEFAULT_EXCHANGE_FACTOR,
  onboardedAt: null,
  remindEvening: false,
  remindHour: DEFAULT_REMIND_HOUR,
};

/**
 * Returns the user's settings, or DEFAULT_SETTINGS if they've never changed anything —
 * no row is created just by reading. Each user's row is looked up only by their own
 * user_id, so one user's settings can never affect another's.
 */
export async function getUserSettings(userId: number): Promise<UserSettings> {
  const result = await pool.query<{
    display_currency: SupportedCurrency;
    timezone: string;
    notify_payments: boolean;
    exchange_factor: string;
    onboarded_at: Date | null;
    remind_evening: boolean;
    remind_hour: number;
  }>(
    `SELECT display_currency, timezone, notify_payments, exchange_factor, onboarded_at, remind_evening, remind_hour
     FROM user_settings WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return DEFAULT_SETTINGS;
  return {
    displayCurrency: row.display_currency,
    timezone: row.timezone,
    notifyPayments: row.notify_payments,
    exchangeFactor: Number(row.exchange_factor),
    onboardedAt: row.onboarded_at,
    remindEvening: row.remind_evening,
    remindHour: row.remind_hour,
  };
}

/** Upserts only the given fields; anything omitted keeps its current (or default) value. */
export async function updateUserSettings(
  userId: number,
  patch: Partial<UserSettings>,
): Promise<UserSettings> {
  const current = await getUserSettings(userId);
  const next: UserSettings = { ...current, ...patch };
  await pool.query(
    `INSERT INTO user_settings (user_id, display_currency, timezone, notify_payments, exchange_factor, onboarded_at,
                                remind_evening, remind_hour, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       display_currency = EXCLUDED.display_currency,
       timezone = EXCLUDED.timezone,
       notify_payments = EXCLUDED.notify_payments,
       exchange_factor = EXCLUDED.exchange_factor,
       onboarded_at = EXCLUDED.onboarded_at,
       remind_evening = EXCLUDED.remind_evening,
       remind_hour = EXCLUDED.remind_hour,
       updated_at = NOW()`,
    [
      userId,
      next.displayCurrency,
      next.timezone,
      next.notifyPayments,
      next.exchangeFactor,
      next.onboardedAt,
      next.remindEvening,
      next.remindHour,
    ],
  );
  return next;
}

export async function resetUserSettings(userId: number): Promise<void> {
  await pool.query("DELETE FROM user_settings WHERE user_id = $1", [userId]);
}
