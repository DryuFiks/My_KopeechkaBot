import { pool } from "../db";

export interface ActivityStats {
  usersTotal: number;
  activeDay: number;
  activeWeek: number;
  transactionsDay: number;
  /** Operations recorded in the last 7 days, by where they were entered (from the events journal). */
  txWeekBot: number;
  txWeekWebapp: number;
}

/**
 * Admin-only aggregate for /health and the morning summary (MKB-045/047). Deliberately not scoped
 * by user_id: it returns only counts across all users, never rows, and is shown only to
 * ADMIN_TELEGRAM_ID (see docs/SECURITY_AUDIT.md). "Active" = recorded an operation or opened the
 * WebApp: transactions cover the time before the events journal existed, events add app opens.
 */
export async function getActivityStats(): Promise<ActivityStats> {
  const result = await pool.query<Record<keyof ActivityStats, string>>(
    `WITH activity AS (
       SELECT user_id, created_at FROM transactions
       UNION ALL
       SELECT user_id, created_at FROM events
     )
     SELECT
       (SELECT count(*) FROM (SELECT user_id FROM transactions UNION SELECT user_id FROM user_settings
                              UNION SELECT user_id FROM events) u) AS "usersTotal",
       (SELECT count(DISTINCT user_id) FROM activity WHERE created_at > NOW() - INTERVAL '1 day') AS "activeDay",
       (SELECT count(DISTINCT user_id) FROM activity WHERE created_at > NOW() - INTERVAL '7 days') AS "activeWeek",
       (SELECT count(*) FROM transactions WHERE created_at > NOW() - INTERVAL '1 day') AS "transactionsDay",
       (SELECT count(*) FROM events WHERE name = 'tx_created' AND source = 'bot'
          AND created_at > NOW() - INTERVAL '7 days') AS "txWeekBot",
       (SELECT count(*) FROM events WHERE name = 'tx_created' AND source = 'webapp'
          AND created_at > NOW() - INTERVAL '7 days') AS "txWeekWebapp"`,
  );
  const row = result.rows[0];
  return {
    usersTotal: Number(row.usersTotal),
    activeDay: Number(row.activeDay),
    activeWeek: Number(row.activeWeek),
    transactionsDay: Number(row.transactionsDay),
    txWeekBot: Number(row.txWeekBot),
    txWeekWebapp: Number(row.txWeekWebapp),
  };
}
