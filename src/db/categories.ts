import { pool } from "../db";

/** Every expense category the user has anywhere: the categories table, budgets and operations. */
export async function listExpenseCategories(userId: number): Promise<string[]> {
  const res = await pool.query<{ name: string }>(
    `SELECT name FROM (
       SELECT name FROM categories WHERE user_id = $1 AND type = 'expense'
       UNION SELECT category FROM budgets WHERE user_id = $1
       UNION SELECT category FROM transactions WHERE user_id = $1 AND type = 'expense' AND category IS NOT NULL
     ) c(name) WHERE name IS NOT NULL ORDER BY name`,
    [userId],
  );
  return res.rows.map((r) => r.name);
}

export interface CategoryUsage {
  transactions: number;
  budgetMonths: number;
}

export async function getCategoryUsage(userId: number, category: string): Promise<CategoryUsage> {
  const res = await pool.query<{ transactions: number; budget_months: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM transactions WHERE user_id = $1 AND type = 'expense' AND category = $2) AS transactions,
       (SELECT COUNT(*)::int FROM budgets WHERE user_id = $1 AND category = $2) AS budget_months`,
    [userId, category],
  );
  return { transactions: res.rows[0].transactions, budgetMonths: res.rows[0].budget_months };
}

export interface CategoryDeleteResult {
  movedTransactions: number;
  /** false when nothing matched the category any more (already deleted) — not an error. */
  deleted: boolean;
}

/**
 * Deletes an expense category in one DB transaction. With `moveTo`, its operations, monthly
 * limits (summed with the target's limit for the same month) and regular payments all go to
 * that category first — nothing is lost and a failure rolls everything back. Every statement
 * is scoped by user_id.
 */
export async function deleteCategory(
  userId: number,
  category: string,
  moveTo: string | null,
): Promise<CategoryDeleteResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let moved = 0;
    if (moveTo !== null) {
      await client.query(
        "INSERT INTO categories (user_id, type, name) VALUES ($1, 'expense', $2) ON CONFLICT DO NOTHING",
        [userId, moveTo],
      );
      const tx = await client.query(
        "UPDATE transactions SET category = $3 WHERE user_id = $1 AND type = 'expense' AND category = $2",
        [userId, category, moveTo],
      );
      moved = tx.rowCount ?? 0;
      await client.query(
        `INSERT INTO budgets (user_id, month, category, limit_gel, rollover)
         SELECT user_id, month, $3, limit_gel, rollover FROM budgets WHERE user_id = $1 AND category = $2
         ON CONFLICT (user_id, month, category) DO UPDATE
           SET limit_gel = budgets.limit_gel + EXCLUDED.limit_gel,
               rollover = budgets.rollover OR EXCLUDED.rollover`,
        [userId, category, moveTo],
      );
      await client.query("UPDATE recurring_payments SET category = $3 WHERE user_id = $1 AND category = $2", [
        userId,
        category,
        moveTo,
      ]);
    }
    const b = await client.query("DELETE FROM budgets WHERE user_id = $1 AND category = $2", [
      userId,
      category,
    ]);
    const c = await client.query(
      "DELETE FROM categories WHERE user_id = $1 AND type = 'expense' AND name = $2",
      [userId, category],
    );
    await client.query("COMMIT");
    return { movedTransactions: moved, deleted: moved > 0 || (b.rowCount ?? 0) > 0 || (c.rowCount ?? 0) > 0 };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
