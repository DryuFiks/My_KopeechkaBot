import { pool } from "../db";
import { logger } from "../logger";

/** MKB-047: what happened, never the data itself (no amounts, categories or texts). */
export type EventName =
  | "app_open"
  | "tx_created"
  | "tx_edited"
  | "goal_contribute"
  | "reminder_tapped"
  | "feedback"
  /** MKB-057: «трат сегодня не было» из вечернего напоминания — день засчитан (и для серии, MKB-060). */
  | "no_spend_day";
export type EventSource = "bot" | "webapp";

/** Fire-and-forget: a lost event must never fail or slow down the user's action. */
export function trackEvent(userId: number, name: EventName, source: EventSource): void {
  pool
    .query("INSERT INTO events (user_id, name, source) VALUES ($1, $2, $3)", [userId, name, source])
    .catch((err) => logger.warn(`event ${name} not recorded: ${(err as Error).message}`));
}
