import { Pool } from "pg";
import { TransactionType } from "./parser";
import { SupportedCurrency } from "./currency";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Check your .env file.");
}

export const pool = new Pool({ connectionString });

pool.on("error", (err) => {
  // Unexpected errors on idle clients — log and keep the process alive.
  console.error(`[db] Unexpected pool error: ${err.message}`);
});

/** Verifies the DB connection at startup. Throws a clear error on failure. */
export async function checkConnection(): Promise<void> {
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not connect to PostgreSQL. Check DATABASE_URL in .env. Details: ${message}`
    );
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
    [userId, type, amount, currency, amountGel, category, note]
  );
  return result.rows[0];
}

export async function getLastTransactions(
  userId: number,
  limit: number
): Promise<Transaction[]> {
  const result = await pool.query<Transaction>(
    `SELECT * FROM transactions
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export interface MonthlySummary {
  income_gel: number;
  expense_gel: number;
  balance_gel: number;
  operation_count: number;
  unconverted_count: number;
}

export async function getMonthlySummary(
  userId: number,
  from: Date,
  to: Date
): Promise<MonthlySummary> {
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
    [userId, from, to]
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

/** Deletes the most recent transaction for this user only. Returns the deleted row, or null if none exist. */
export async function deleteLastTransaction(userId: number): Promise<Transaction | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<Transaction>(
      `SELECT id FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );
    if (found.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    const id = found.rows[0].id;
    const deleted = await client.query<Transaction>(
      `DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );
    await client.query("COMMIT");
    return deleted.rows[0] ?? null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
