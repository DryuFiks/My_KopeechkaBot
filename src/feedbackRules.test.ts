import { describe, expect, it } from "vitest";
import {
  FEEDBACK_COOLDOWN_MS,
  FeedbackCooldown,
  MAX_FEEDBACK,
  checkFeedback,
  formatFeedback,
} from "./feedbackRules";

describe("checkFeedback", () => {
  it("trims and accepts normal text", () => {
    expect(checkFeedback("  нет кнопки экспорта \n")).toEqual({ ok: true, text: "нет кнопки экспорта" });
  });

  it("rejects empty, non-string and too long input", () => {
    expect(checkFeedback("   ")).toEqual({ ok: false, reason: "empty" });
    expect(checkFeedback(undefined)).toEqual({ ok: false, reason: "empty" });
    expect(checkFeedback(42)).toEqual({ ok: false, reason: "empty" });
    expect(checkFeedback("x".repeat(MAX_FEEDBACK + 1))).toEqual({ ok: false, reason: "too_long" });
    expect(checkFeedback("x".repeat(MAX_FEEDBACK)).ok).toBe(true);
  });
});

describe("FeedbackCooldown", () => {
  it("allows one message per user per cooldown", () => {
    const c = new FeedbackCooldown();
    expect(c.take(1, 0)).toBe(true);
    expect(c.take(1, 1000)).toBe(false);
    expect(c.take(2, 1000)).toBe(true);
    expect(c.take(1, FEEDBACK_COOLDOWN_MS)).toBe(true);
  });
});

describe("formatFeedback", () => {
  it("names the sender and the source, escaping HTML", () => {
    const text = formatFeedback({ id: 7, name: "Аня <3", username: "anya" }, "<b>жирно</b>", "webapp");
    expect(text).toContain("из мини-приложения");
    expect(text).toContain("Аня &lt;3 (@anya), id 7");
    expect(text).toContain("&lt;b&gt;жирно&lt;/b&gt;");
  });

  it("works without a username", () => {
    expect(formatFeedback({ id: 7, name: "Аня" }, "ok", "bot")).toContain("От: Аня, id 7");
  });
});
