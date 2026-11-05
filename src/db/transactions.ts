import { pool, type Transaction } from "../db";
import type { SupportedCurrency } from "../currencies";
import type { TransactionFilter } from "../transactionSearch";

/**
 * MKB-056: one page of the user's operations in [from, to) matching the filter, newest first.
 * `pattern` is already escaped (transactionSearch.ts) and passed as a parameter — never spliced into SQL.
 */
export async function searchTransactionsForRange(
  userId: number,
  from: Date,
  to: Date,
  filter: TransactionFilter,
  limit: number,
  offset: number,
): Promise<Transaction[]> {
  const r = await pool.query<Transaction>(
    `SELECT * FROM transactions
     WHERE user_id = $1 AND created_at >= $2 AND created_at < $3
       AND ($4::text IS NULL OR category ILIKE $4 ESCAPE '\\' OR note ILIKE $4 ESCAPE '\\')
       AND ($5::text IS NULL OR type = $5)
     ORDER BY created_at DESC, id DESC
     LIMIT $6 OFFSET $7`,
    [userId, from, to, filter.pattern, filter.type, limit, offset],
  );
  return r.rows;
}

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
