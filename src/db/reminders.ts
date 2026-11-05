import { pool } from "../db";

export interface EveningCandidate {
  userId: number;
  timezone: string;
  remindHour: number;
  /** "YYYY-MM-DD" of the last evening reminder, or null. */
  lastNotified: string | null;
  lastRecordAt: Date | null;
  lastActiveAt: Date | null;
}

/**
 * MKB-057: everyone who turned the evening reminder on, with what the rule needs. Not scoped by one
 * user_id on purpose — like getRemindablePayments, it's read only by the scheduler, which then writes
 * to each user only about their own data (docs/SECURITY_AUDIT.md).
 */
export async function getEveningCandidates(): Promise<EveningCandidate[]> {
  const r = await pool.query<{
    user_id: string;
    timezone: string;
    remind_hour: number;
    evening_notified: string | null;
    last_tx: Date | null;
    last_no_spend: Date | null;
    last_event: Date | null;
  }>(
    `SELECT s.user_id, s.timezone, s.remind_hour, to_char(s.evening_notified, 'YYYY-MM-DD') AS evening_notified,
            (SELECT max(created_at) FROM transactions t WHERE t.user_id = s.user_id) AS last_tx,
            (SELECT max(created_at) FROM events e WHERE e.user_id = s.user_id AND e.name = 'no_spend_day') AS last_no_spend,
            (SELECT max(created_at) FROM events e WHERE e.user_id = s.user_id) AS last_event
     FROM user_settings s
     WHERE s.remind_evening`,
  );
  const latest = (...ds: (Date | null)[]) =>
    ds.reduce<Date | null>((a, d) => (d && (!a || d > a) ? d : a), null);
  return r.rows.map((row) => ({
    userId: Number(row.user_id),
    timezone: row.timezone,
    remindHour: row.remind_hour,
    lastNotified: row.evening_notified,
    lastRecordAt: latest(row.last_tx, row.last_no_spend),
    lastActiveAt: latest(row.last_tx, row.last_event),
  }));
}

export async function markEveningNotified(userId: number, dayIso: string): Promise<void> {
  await pool.query("UPDATE user_settings SET evening_notified = $2 WHERE user_id = $1", [userId, dayIso]);
}

export interface DigestCandidate {
  userId: number;
  timezone: string;
  lastSent: string | null;
  lastActiveAt: Date | null;
}

/** MKB-058: everyone who turned the weekly digest on (scheduler-only, like getEveningCandidates). */
export async function getDigestCandidates(): Promise<DigestCandidate[]> {
  const r = await pool.query<{
    user_id: string;
    timezone: string;
    digest_notified: string | null;
    last_active: Date | null;
  }>(
    `SELECT s.user_id, s.timezone, to_char(s.digest_notified, 'YYYY-MM-DD') AS digest_notified,
            GREATEST((SELECT max(created_at) FROM transactions t WHERE t.user_id = s.user_id),
                     (SELECT max(created_at) FROM events e WHERE e.user_id = s.user_id)) AS last_active
     FROM user_settings s
     WHERE s.weekly_digest`,
  );
  return r.rows.map((row) => ({
    userId: Number(row.user_id),
    timezone: row.timezone,
    lastSent: row.digest_notified,
    lastActiveAt: row.last_active,
  }));
}

export async function markDigestSent(userId: number, dayIso: string): Promise<void> {
  await pool.query("UPDATE user_settings SET digest_notified = $2 WHERE user_id = $1", [userId, dayIso]);
}
