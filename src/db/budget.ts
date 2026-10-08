import { pool } from "../db";
import type { CategoryKind } from "../budgetRules";

export interface BudgetCategoryReport {
  category: string | null;
  kind: CategoryKind;
  limitGel: number | null;
  spentGel: number;
  rollover: boolean;
  /** limitGel plus last month's unspent limit, when rollover is on; equals limitGel otherwise. */
  effectiveLimitGel: number | null;
}

/**
 * Plan vs fact for one month: every category that has either a budget limit or actual
 * spending, merged so nothing is silently dropped (a category with spend but no limit
 * shows up with limitGel: null, not omitted). A rollover category carries its previous
 * month's unspent limit forward, but only when positive — an overspent previous month
 * never shrinks this month's limit, and past months are never rewritten.
 */
export async function getBudgetReport(userId: number, from: Date, to: Date): Promise<BudgetCategoryReport[]> {
  const current = await pool.query<{
    category: string | null;
    limit_gel: string | null;
    rollover: boolean;
    spent: string;
    kind: CategoryKind;
  }>(
    `SELECT
       COALESCE(b.category, agg.category) AS category,
       b.limit_gel,
       COALESCE(b.rollover, false) AS rollover,
       COALESCE(agg.spent, 0) AS spent,
       COALESCE(c.kind, 'variable') AS kind
     FROM (
       SELECT category, limit_gel, rollover FROM budgets WHERE user_id = $1 AND month = $2
     ) b
     FULL OUTER JOIN (
       SELECT category, SUM(amount_gel) AS spent
       FROM transactions
       WHERE user_id = $1 AND type = 'expense' AND created_at >= $2 AND created_at < $3
       GROUP BY category
     ) agg ON agg.category = b.category
     LEFT JOIN categories c
       ON c.user_id = $1 AND c.type = 'expense' AND c.name = COALESCE(b.category, agg.category)
     ORDER BY category NULLS LAST`,
    [userId, from, to],
  );

  const rolloverCategories = current.rows.filter((row) => row.rollover && row.category !== null);
  const prevLeftover = new Map<string, number>();
  if (rolloverCategories.length > 0) {
    const prevFrom = new Date(from.getFullYear(), from.getMonth() - 1, 1);
    const prev = await pool.query<{ category: string | null; leftover: string }>(
      `SELECT
         COALESCE(b.category, agg.category) AS category,
         COALESCE(b.limit_gel, 0) - COALESCE(agg.spent, 0) AS leftover
       FROM (
         SELECT category, limit_gel FROM budgets WHERE user_id = $1 AND month = $2
       ) b
       FULL OUTER JOIN (
         SELECT category, SUM(amount_gel) AS spent
         FROM transactions
         WHERE user_id = $1 AND type = 'expense' AND created_at >= $2 AND created_at < $3
         GROUP BY category
       ) agg ON agg.category = b.category`,
      [userId, prevFrom, from],
    );
    for (const row of prev.rows) {
      if (row.category) prevLeftover.set(row.category, parseFloat(row.leftover));
    }
  }

  return current.rows.map((row) => {
    const limitGel = row.limit_gel !== null ? parseFloat(row.limit_gel) : null;
    const leftover = row.rollover && row.category ? Math.max(0, prevLeftover.get(row.category) ?? 0) : 0;
    return {
      category: row.category,
      kind: row.kind,
      limitGel,
      spentGel: parseFloat(row.spent),
      rollover: row.rollover,
      effectiveLimitGel: limitGel !== null ? limitGel + leftover : null,
    };
  });
}

/**
 * Total budget remaining (limit minus spent, summed across every categorized month in
 * [from, to)) for the dashboard's KPI card. Budgets are monthly, so a quarter/year range
 * sums each calendar month inside it. Returns null when no budget exists anywhere in the
 * range — a real 0 (fully spent) is never confused with "no budget was set".
 */
export async function getBudgetRemainingForRange(
  userId: number,
  from: Date,
  to: Date,
): Promise<number | null> {
  let total = 0;
  let hasAnyBudget = false;
  let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor < to) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const report = await getBudgetReport(userId, cursor, monthEnd);
    for (const row of report) {
      if (row.effectiveLimitGel !== null) {
        total += row.effectiveLimitGel - row.spentGel;
        hasAnyBudget = true;
      }
    }
    cursor = monthEnd;
  }
  return hasAnyBudget ? Math.round(total * 100) / 100 : null;
}

/** Creates or replaces this month's limit; keeps an existing rollover flag untouched. */
export async function setBudgetLimit(
  userId: number,
  month: Date,
  category: string,
  limitGel: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO budgets(user_id,month,category,limit_gel) VALUES($1,$2,$3,$4)
     ON CONFLICT(user_id,month,category) DO UPDATE SET limit_gel=EXCLUDED.limit_gel`,
    [userId, month, category, limitGel],
  );
}

/** Returns false when there was no such limit (already removed) — not an error. */
export async function deleteBudgetLimit(userId: number, month: Date, category: string): Promise<boolean> {
  const r = await pool.query("DELETE FROM budgets WHERE user_id=$1 AND month=$2 AND category=$3", [
    userId,
    month,
    category,
  ]);
  return (r.rowCount ?? 0) > 0;
}

/** Returns false when no limit exists yet for the category (a rollover needs a limit first). */
export async function setBudgetRollover(
  userId: number,
  month: Date,
  category: string,
  enabled: boolean,
): Promise<boolean> {
  const r = await pool.query("UPDATE budgets SET rollover=$4 WHERE user_id=$1 AND month=$2 AND category=$3", [
    userId,
    month,
    category,
    enabled,
  ]);
  return (r.rowCount ?? 0) > 0;
}
