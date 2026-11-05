// Sending user feedback to the admin (MKB-047) — shared by /feedback in the chat and the WebApp form.
// Rules (length, cooldown, text) are in feedbackRules.ts.

import type { Api } from "grammy";
import { getAdminId } from "./adminAlerts";
import { trackEvent, type EventSource } from "./db/events";
import { FeedbackCooldown, checkFeedback, formatFeedback } from "./feedbackRules";

export type FeedbackResult = "sent" | "empty" | "too_long" | "too_soon" | "unavailable";

const cooldown = new FeedbackCooldown();

export async function submitFeedback(
  api: Api,
  user: { id: number; name: string; username?: string },
  raw: unknown,
  source: EventSource,
): Promise<FeedbackResult> {
  const adminId = getAdminId();
  if (adminId === null) return "unavailable";
  const check = checkFeedback(raw);
  if (!check.ok) return check.reason;
  if (!cooldown.take(user.id, Date.now())) return "too_soon";
  await api.sendMessage(adminId, formatFeedback(user, check.text, source), { parse_mode: "HTML" });
  trackEvent(user.id, "feedback", source);
  return "sent";
}
