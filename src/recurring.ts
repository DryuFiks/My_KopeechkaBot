import { pool } from "./db";
import { convertToGel, refreshRatesIfStale } from "./currency";
import { logger } from "./logger";

export type RecurringPeriod = "daily" | "weekly" | "monthly";
export interface RecurringPayment {
  id: number;
  user_id: string;
  type: "expense" | "income";
  amount: string;
  currency: "RUB" | "GEL" | "USD";
  category: string | null;
  note: string | null;
  period: RecurringPeriod;
  next_run_at: Date;
  is_active: boolean;
}
function nextDate(from: Date, period: RecurringPeriod): Date {
  const d = new Date(from);
  if (period === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (period === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d;
}
export async function addRecurring(p: {
  userId: number;
  type: "expense" | "income";
  amount: number;
  currency: "RUB" | "GEL" | "USD";
  category: string | null;
  note: string | null;
  period: RecurringPeriod;
  nextRun: Date;
}): Promise<RecurringPayment> {
  const r = await pool.query<RecurringPayment>(
    `INSERT INTO recurring (user_id,type,amount,currency,category,note,period,next_run_at)
 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [p.userId, p.type, p.amount, p.currency, p.category, p.note, p.period, p.nextRun],
  );
  return r.rows[0];
}
export async function listRecurring(userId: number): Promise<RecurringPayment[]> {
  const r = await pool.query<RecurringPayment>(
    `SELECT * FROM recurring WHERE user_id=$1 ORDER BY is_active DESC,next_run_at,id`,
    [userId],
  );
  return r.rows;
}
export async function removeRecurring(userId: number, id: number): Promise<boolean> {
  const r = await pool.query(`DELETE FROM recurring WHERE user_id=$1 AND id=$2`, [userId, id]);
  return (r.rowCount ?? 0) > 0;
}
export async function toggleRecurring(userId: number, id: number): Promise<boolean> {
  const r = await pool.query(`UPDATE recurring SET is_active=NOT is_active WHERE user_id=$1 AND id=$2`, [
    userId,
    id,
  ]);
  return (r.rowCount ?? 0) > 0;
}
/** Processes due entries transactionally. Row locks prevent duplicate execution across bot instances. */
export async function processDueRecurring(
  notify?: (userId: number, text: string) => Promise<unknown>,
): Promise<void> {
  await refreshRatesIfStale();
  const client = await pool.connect();
  const processed: RecurringPayment[] = [];
  try {
    await client.query("BEGIN");
    const due = await client.query<RecurringPayment>(
      `SELECT * FROM recurring WHERE is_active=true AND next_run_at<=NOW()
    ORDER BY next_run_at LIMIT 100 FOR UPDATE SKIP LOCKED`,
    );
    for (const p of due.rows) {
      const amount = Number(p.amount);
      const gel = convertToGel(amount, p.currency);
      await client.query(
        `INSERT INTO transactions(user_id,type,amount,currency,amount_gel,category,note)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          p.user_id,
          p.type,
          amount,
          p.currency,
          gel,
          p.category,
          [p.note, `Регулярный платёж #${p.id}`].filter(Boolean).join(" — ").slice(0, 200),
        ],
      );
      await client.query(`UPDATE recurring SET next_run_at=$2,last_run_at=NOW() WHERE id=$1`, [
        p.id,
        nextDate(p.next_run_at, p.period),
      ]);
      processed.push(p);
      // Notification is sent by caller in future; transaction itself remains durable.
    }
    await client.query("COMMIT");
    if (due.rowCount) logger.info(`Processed ${due.rowCount} recurring payment(s).`);
    if (notify)
      for (const p of processed) {
        try {
          await notify(
            Number(p.user_id),
            `🔁 Регулярная операция записана: ${p.type === "expense" ? "расход" : "доход"} ${p.amount} ${p.currency}${p.category ? `, ${p.category}` : ""}.`,
          );
        } catch (e) {
          logger.warn(`Could not notify recurring payment #${p.id}: ${(e as Error).message}`);
        }
      }
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
