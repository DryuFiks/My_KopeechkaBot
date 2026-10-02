import { pool } from "../db";
import type { SupportedCurrency } from "../currencies";

export interface RecurringPayment {
  id: number;
  user_id: string;
  title: string;
  amount: string;
  currency: SupportedCurrency;
  category: string | null;
  due_day: number;
  active: boolean;
  last_notified: Date | null;
  created_at: Date;
}

/** Every payment, active and paused — a paused payment is still shown, just marked. */
export async function listPayments(userId: number): Promise<RecurringPayment[]> {
  const result = await pool.query<RecurringPayment>(
    "SELECT * FROM recurring_payments WHERE user_id=$1 ORDER BY active DESC, due_day",
    [userId],
  );
  return result.rows;
}

export async function createPayment(
  userId: number,
  dueDay: number,
  amount: number,
  currency: SupportedCurrency,
  title: string,
): Promise<RecurringPayment> {
  const result = await pool.query<RecurringPayment>(
    "INSERT INTO recurring_payments(user_id,due_day,amount,currency,title) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [userId, dueDay, amount, currency, title],
  );
  return result.rows[0];
}

export async function findPayment(userId: number, id: number): Promise<RecurringPayment | null> {
  const result = await pool.query<RecurringPayment>(
    "SELECT * FROM recurring_payments WHERE id=$1 AND user_id=$2",
    [id, userId],
  );
  return result.rows[0] ?? null;
}

/** Pause/resume — reversible, unlike deletePayment, so it needs no confirmation. */
export async function togglePaymentActive(userId: number, id: number): Promise<RecurringPayment | null> {
  const result = await pool.query<RecurringPayment>(
    "UPDATE recurring_payments SET active = NOT active WHERE id=$1 AND user_id=$2 RETURNING *",
    [id, userId],
  );
  return result.rows[0] ?? null;
}

/** A real, permanent delete — pausing (togglePaymentActive) is the reversible alternative. */
export async function deletePayment(userId: number, id: number): Promise<RecurringPayment | null> {
  const result = await pool.query<RecurringPayment>(
    "DELETE FROM recurring_payments WHERE id=$1 AND user_id=$2 RETURNING *",
    [id, userId],
  );
  return result.rows[0] ?? null;
}

export interface RemindablePayment extends Omit<RecurringPayment, "last_notified"> {
  /** "YYYY-MM-DD" text — a DATE parsed into a JS Date shifts by the server's UTC offset. */
  last_notified: string | null;
  timezone: string;
  notify_payments: boolean;
}

/** Active payments joined with their owner's timezone/notification preference (defaults when unset). */
export async function getRemindablePayments(): Promise<RemindablePayment[]> {
  const result = await pool.query<RemindablePayment>(
    `SELECT rp.*,
            rp.last_notified::text AS last_notified,
            COALESCE(us.timezone, 'Asia/Tbilisi') AS timezone,
            COALESCE(us.notify_payments, true) AS notify_payments
     FROM recurring_payments rp
     LEFT JOIN user_settings us ON us.user_id = rp.user_id
     WHERE rp.active = true`,
  );
  return result.rows;
}

/** `todayIso` is the owner's local date ("YYYY-MM-DD"), not the DB server's CURRENT_DATE. */
export async function markPaymentNotified(id: number, todayIso: string): Promise<void> {
  await pool.query("UPDATE recurring_payments SET last_notified = $2::date WHERE id = $1", [id, todayIso]);
}
