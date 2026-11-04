// Pure part of user feedback (MKB-047): what counts as a valid message, how often, and how the
// admin sees it. The sending shell is feedback.ts.

import { escapeHtml } from "./format";

export const MAX_FEEDBACK = 1000;
export const FEEDBACK_COOLDOWN_MS = 30_000;

export type FeedbackCheck = { ok: true; text: string } | { ok: false; reason: "empty" | "too_long" };

export function checkFeedback(raw: unknown): FeedbackCheck {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > MAX_FEEDBACK) return { ok: false, reason: "too_long" };
  return { ok: true, text };
}

/** One message per user per cooldown — guards against double taps and accidental floods. */
export class FeedbackCooldown {
  private readonly last = new Map<number, number>();

  constructor(private readonly cooldownMs = FEEDBACK_COOLDOWN_MS) {}

  take(userId: number, now: number): boolean {
    const prev = this.last.get(userId);
    if (prev !== undefined && now - prev < this.cooldownMs) return false;
    this.last.set(userId, now);
    return true;
  }
}

export function formatFeedback(
  user: { id: number; name: string; username?: string },
  text: string,
  source: "bot" | "webapp",
): string {
  const who = `${escapeHtml(user.name)}${user.username ? ` (@${escapeHtml(user.username)})` : ""}, id ${user.id}`;
  const where = source === "bot" ? "из чата" : "из мини-приложения";
  return `💬 <b>Отзыв</b> ${where}\nОт: ${who}\n\n${escapeHtml(text)}`;
}
