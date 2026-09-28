import { Pool } from "pg";
import type { TransactionType } from "./parser";
import type { SupportedCurrency } from "./currencies";
import { logger } from "./logger";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Check your .env file.");
}

export const pool = new Pool({ connectionString });

pool.on("error", (err) => {
  // Unexpected errors on idle clients — log and keep the process alive.
  logger.error(`Unexpected pool error: ${err.message}`);
});

/** Verifies the DB connection at startup. Throws a clear error on failure. */
export async function checkConnection(): Promise<void> {
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not connect to PostgreSQL. Check DATABASE_URL in .env. Details: ${message}`);
  }
}

export interface Transaction {
  id: number;
  user_id: string;
  type: TransactionType;
  amount: string;
  currency: SupportedCurrency;
  amount_gel: string | null;
  category: string | null;
  note: string | null;
  created_at: Date;
}

export async function insertTransaction(params: {
  userId: number;
  type: TransactionType;
  amount: number;
  currency: SupportedCurrency;
  amountGel: number | null;
  category: string | null;
  note: string | null;
}): Promise<Transaction> {
  const { userId, type, amount, currency, amountGel, category, note } = params;
  const result = await pool.query<Transaction>(
    `INSERT INTO transactions (user_id, type, amount, currency, amount_gel, category, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, type, amount, currency, amountGel, category, note],
  );
  return result.rows[0];
}

export async function getLastTransactions(userId: number, limit: number): Promise<Transaction[]> {
  const result = await pool.query<Transaction>(
    `SELECT * FROM transactions
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}

export interface PeriodSummary {
  income_gel: number;
  expense_gel: number;
  balance_gel: number;
  operation_count: number;
  unconverted_count: number;
}

/** Summarizes transactions in [from, to). Used by both /month and /today. */
export async function getSummaryForRange(userId: number, from: Date, to: Date): Promise<PeriodSummary> {
  const result = await pool.query<{
    income_gel: string | null;
    expense_gel: string | null;
    operation_count: string;
    unconverted_count: string;
  }>(
    `SELECT
       COALESCE(SUM(amount_gel) FILTER (WHERE type = 'income'), 0)  AS income_gel,
       COALESCE(SUM(amount_gel) FILTER (WHERE type = 'expense'), 0) AS expense_gel,
       COUNT(*) AS operation_count,
       COUNT(*) FILTER (WHERE amount_gel IS NULL) AS unconverted_count
     FROM transactions
     WHERE user_id = $1 AND created_at >= $2 AND created_at < $3`,
    [userId, from, to],
  );
  const row = result.rows[0];
  const incomeGel = parseFloat(row.income_gel ?? "0");
  const expenseGel = parseFloat(row.expense_gel ?? "0");
  return {
    income_gel: incomeGel,
    expense_gel: expenseGel,
    balance_gel: Math.round((incomeGel - expenseGel) * 100) / 100,
    operation_count: parseInt(row.operation_count, 10),
    unconverted_count: parseInt(row.unconverted_count, 10),
  };
}

/**
 * Deletes one specific transaction (by id, scoped to its owner). Idempotent by design:
 * undoing the same id twice (a duplicate callback, a double tap) just finds no row the
 * second time instead of deleting a different, unrelated transaction.
 */
export async function deleteTransactionById(userId: number, id: number): Promise<Transaction | null> {
  const result = await pool.query<Transaction>(
    `DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId],
  );
  return result.rows[0] ?? null;
}

export interface BalanceOverview {
  totalGel: number;
  unconvertedByCurrency: { currency: SupportedCurrency; amount: number }[];
}

/**
 * All-time balance across every transaction the user has (income minus expense, in GEL).
 * Transactions whose currency couldn't be converted (amount_gel IS NULL) are never
 * guessed at — their raw per-currency totals are reported separately instead.
 */
export async function getBalanceOverview(userId: number): Promise<BalanceOverview> {
  const gelResult = await pool.query<{ total: string | null }>(
    `SELECT COALESCE(SUM(amount_gel) FILTER (WHERE type = 'income'), 0)
          - COALESCE(SUM(amount_gel) FILTER (WHERE type = 'expense'), 0) AS total
     FROM transactions
     WHERE user_id = $1`,
    [userId],
  );
  const unconvertedResult = await pool.query<{ currency: SupportedCurrency; amount: string }>(
    `SELECT currency,
            COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)
              - COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS amount
     FROM transactions
     WHERE user_id = $1 AND amount_gel IS NULL
     GROUP BY currency`,
    [userId],
  );
  return {
    totalGel: Math.round(parseFloat(gelResult.rows[0]?.total ?? "0") * 100) / 100,
    unconvertedByCurrency: unconvertedResult.rows.map((row) => ({
      currency: row.currency,
      amount: parseFloat(row.amount),
    })),
  };
}

/**
 * Categories the user already uses for this transaction type: most-used from their
 * transaction history, merged with any categories they created explicitly but never
 * (yet) used, ordered by usage then recency.
 */
export async function getRecentCategories(
  userId: number,
  type: TransactionType,
  limit = 8,
): Promise<string[]> {
  const result = await pool.query<{ name: string }>(
    `SELECT name FROM (
       SELECT category AS name, COUNT(*)::int AS uses, MAX(created_at) AS last_used
       FROM transactions
       WHERE user_id = $1 AND type = $2 AND category IS NOT NULL
       GROUP BY category
       UNION ALL
       SELECT name, 0 AS uses, NULL::timestamptz AS last_used
       FROM categories
       WHERE user_id = $1 AND type = $2
     ) combined
     GROUP BY name
     ORDER BY MAX(uses) DESC, MAX(last_used) DESC NULLS LAST
     LIMIT $3`,
    [userId, type, limit],
  );
  return result.rows.map((row) => row.name);
}

export interface CategoryTotal {
  category: string | null;
  amountGel: number;
}

/** Expense totals per category in [from, to) — the raw data behind the structure chart. */
export async function getExpenseCategoryTotals(
  userId: number,
  from: Date,
  to: Date,
): Promise<CategoryTotal[]> {
  const result = await pool.query<{ category: string | null; total: string }>(
    `SELECT category, COALESCE(SUM(amount_gel), 0) AS total
     FROM transactions
     WHERE user_id = $1 AND type = 'expense' AND created_at >= $2 AND created_at < $3
     GROUP BY category
     ORDER BY total DESC`,
    [userId, from, to],
  );
  return result.rows.map((row) => ({ category: row.category, amountGel: parseFloat(row.total) }));
}

/**
 * Expense transactions for one category in [from, to) — the drill-down behind a
 * structure-chart row. `category: null` matches "Без категории" (IS NOT DISTINCT FROM
 * handles the NULL case that plain `=` can't).
 */
export async function getTransactionsByCategory(
  userId: number,
  category: string | null,
  from: Date,
  to: Date,
): Promise<Transaction[]> {
  const result = await pool.query<Transaction>(
    `SELECT * FROM transactions
     WHERE user_id = $1 AND type = 'expense' AND category IS NOT DISTINCT FROM $2
       AND created_at >= $3 AND created_at < $4
     ORDER BY created_at DESC, id DESC
     LIMIT 200`,
    [userId, category, from, to],
  );
  return result.rows;
}

export interface ExpenseBucket {
  bucket: Date;
  amountGel: number;
}

/**
 * Expense totals bucketed by day or by month across [from, to), with every bucket present
 * (zero-filled) even when there was no spending — a trend line must not silently skip
 * empty days. Buckets one query at a time (not SQL date_trunc) so day/month boundaries
 * follow the same local-time range comparison as the rest of the app, not the Postgres
 * session timezone, which could otherwise shift a near-midnight transaction by a day.
 */
export async function getExpenseSeries(
  userId: number,
  from: Date,
  to: Date,
  granularity: "day" | "month",
): Promise<ExpenseBucket[]> {
  const buckets: ExpenseBucket[] = [];
  let cursor = new Date(from);
  while (cursor < to) {
    const next =
      granularity === "day"
        ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
        : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const result = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_gel), 0) AS total
       FROM transactions
       WHERE user_id = $1 AND type = 'expense' AND created_at >= $2 AND created_at < $3`,
      [userId, cursor, next],
    );
    buckets.push({ bucket: new Date(cursor), amountGel: parseFloat(result.rows[0].total) });
    cursor = next;
  }
  return buckets;
}

export async function closePool(): Promise<void> {
  await pool.end();
}
