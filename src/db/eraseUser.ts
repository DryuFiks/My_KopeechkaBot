import { pool } from "../db";

/** Every table that holds a user's rows, each keyed by `user_id`. Keep in sync with sql/*.sql. */
const USER_TABLES = [
  "transactions",
  "categories",
  "budgets",
  "recurring_payments",
  "recurring",
  "savings_goals",
  "debts",
  "income_receipts",
  "income_sources",
  "planned_expenses",
  "user_achievements",
  "user_progress",
  "user_settings",
] as const;

/**
 * Permanently deletes everything stored about one user, in a single DB transaction (all or
 * nothing). With the settings row gone the user is "not onboarded" again, so the app starts
 * from the first-run wizard. Returns the number of rows removed.
 */
export async function eraseUserData(userId: number): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let removed = 0;
    for (const table of USER_TABLES) {
      const r = await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
      removed += r.rowCount ?? 0;
    }
    await client.query("COMMIT");
    return removed;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
