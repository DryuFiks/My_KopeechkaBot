import { pool } from "../db";

export interface ActivityStats {
  usersTotal: number;
  activeDay: number;
  activeWeek: number;
  transactionsDay: number;
}

/**
 * Admin-only aggregate for the morning summary (MKB-045). Deliberately not scoped by user_id:
 * it returns only counts across all users, never rows, and is called only by the admin
 * summary scheduler (see docs/SECURITY_AUDIT.md).
 */
export async function getActivityStats(): Promise<ActivityStats> {
  const result = await pool.query<{
    users_total: string;
    active_day: string;
    active_week: string;
    transactions_day: string;
  }>(
    `SELECT
       (SELECT count(*) FROM (SELECT user_id FROM transactions UNION SELECT user_id FROM user_settings) u) AS users_total,
       count(DISTINCT user_id) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') AS active_day,
       count(DISTINCT user_id) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS active_week,
       count(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') AS transactions_day
     FROM transactions`,
  );
  const row = result.rows[0];
  return {
    usersTotal: Number(row.users_total),
    activeDay: Number(row.active_day),
    activeWeek: Number(row.active_week),
    transactionsDay: Number(row.transactions_day),
  };
}
