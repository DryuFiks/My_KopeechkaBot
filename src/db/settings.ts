import { pool } from "../db";
import type { SupportedCurrency } from "../currencies";

export interface UserSettings {
  displayCurrency: SupportedCurrency;
  timezone: string;
  notifyPayments: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  displayCurrency: "GEL",
  timezone: "Asia/Tbilisi",
  notifyPayments: true,
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
  }>("SELECT display_currency, timezone, notify_payments FROM user_settings WHERE user_id = $1", [userId]);
  const row = result.rows[0];
  if (!row) return DEFAULT_SETTINGS;
  return {
    displayCurrency: row.display_currency,
    timezone: row.timezone,
    notifyPayments: row.notify_payments,
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
    `INSERT INTO user_settings (user_id, display_currency, timezone, notify_payments, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       display_currency = EXCLUDED.display_currency,
       timezone = EXCLUDED.timezone,
       notify_payments = EXCLUDED.notify_payments,
       updated_at = NOW()`,
    [userId, next.displayCurrency, next.timezone, next.notifyPayments],
  );
  return next;
}

export async function resetUserSettings(userId: number): Promise<void> {
  await pool.query("DELETE FROM user_settings WHERE user_id = $1", [userId]);
}
