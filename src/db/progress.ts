import { pool } from "../db";
import type { DayCount } from "../achievements";

export interface OperationStats {
  operations: number;
  categorized: number;
  nightOwl: boolean;
}

/** Counts and the "after midnight" flag, all in the user's own timezone. */
export async function getOperationStats(userId: number, timeZone: string): Promise<OperationStats> {
  const res = await pool.query<{ operations: number; categorized: number; night: boolean }>(
    `SELECT COUNT(*)::int AS operations,
            COUNT(category)::int AS categorized,
            COALESCE(BOOL_OR(EXTRACT(HOUR FROM created_at AT TIME ZONE $2) < 5), false) AS night
     FROM transactions WHERE user_id = $1`,
    [userId, timeZone],
  );
  const r = res.rows[0];
  return { operations: r.operations, categorized: r.categorized, nightOwl: r.night };
}

export async function getOperationDays(userId: number, timeZone: string): Promise<DayCount[]> {
  const res = await pool.query<{ day: string; count: number }>(
    `SELECT to_char(created_at AT TIME ZONE $2, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
     FROM transactions WHERE user_id = $1 GROUP BY 1`,
    [userId, timeZone],
  );
  return res.rows;
}

export async function getGoalStats(userId: number): Promise<{ created: number; reached: number }> {
  const res = await pool.query<{ created: number; reached: number }>(
    `SELECT COUNT(*)::int AS created,
            (COUNT(*) FILTER (WHERE saved_gel >= target_gel))::int AS reached
     FROM savings_goals WHERE user_id = $1`,
    [userId],
  );
  return res.rows[0];
}

/** Inserts only the achievements not yet stored and returns exactly those (race-safe: ON CONFLICT). */
export async function insertNewAchievements(userId: number, codes: string[]): Promise<string[]> {
  if (codes.length === 0) return [];
  const res = await pool.query<{ code: string }>(
    `INSERT INTO user_achievements (user_id, code)
     SELECT $1, unnest($2::text[])
     ON CONFLICT (user_id, code) DO NOTHING
     RETURNING code`,
    [userId, codes],
  );
  return res.rows.map((r) => r.code);
}

export async function listUnlocked(userId: number): Promise<Map<string, Date>> {
  const res = await pool.query<{ code: string; unlocked_at: Date }>(
    "SELECT code, unlocked_at FROM user_achievements WHERE user_id = $1",
    [userId],
  );
  return new Map(res.rows.map((r) => [r.code, r.unlocked_at]));
}

export async function getStoredRankIndex(userId: number): Promise<number> {
  const res = await pool.query<{ rank_index: number }>(
    "SELECT rank_index FROM user_progress WHERE user_id = $1",
    [userId],
  );
  return res.rows[0]?.rank_index ?? 0;
}

/** Raises the stored rank (never lowers it). True only when this call actually raised it. */
export async function raiseStoredRank(userId: number, rankIndex: number): Promise<boolean> {
  const res = await pool.query(
    `INSERT INTO user_progress (user_id, rank_index) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET rank_index = EXCLUDED.rank_index, updated_at = NOW()
     WHERE user_progress.rank_index < EXCLUDED.rank_index
     RETURNING rank_index`,
    [userId, rankIndex],
  );
  return (res.rowCount ?? 0) > 0;
}
