import { pool, type Transaction } from "../db";
import type { SupportedCurrency } from "../currencies";

/** One operation of this user, or null (someone else's id is "not found", never an error). */
export async function findTransaction(userId: number, id: number): Promise<Transaction | null> {
  const r = await pool.query<Transaction>("SELECT * FROM transactions WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
  return r.rows[0] ?? null;
}

/** MKB-053: rewrites an operation's editable fields; the type (expense/income) never changes. */
export async function updateTransaction(
  userId: number,
  id: number,
  f: {
    amount: number;
    currency: SupportedCurrency;
    amountGel: number | null;
    category: string | null;
    note: string | null;
    createdAt: Date;
  },
): Promise<Transaction | null> {
  const r = await pool.query<Transaction>(
    `UPDATE transactions
     SET amount = $3, currency = $4, amount_gel = $5, category = $6, note = $7, created_at = $8
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, f.amount, f.currency, f.amountGel, f.category, f.note, f.createdAt],
  );
  return r.rows[0] ?? null;
}
