import { describe, expect, it } from "vitest";
import {
  ALERT_WINDOW_MS,
  AlertThrottle,
  ErrorTally,
  alertKey,
  formatAdminSummary,
  formatErrorAlert,
  isSummaryDue,
} from "./adminAlertRules";

describe("alertKey", () => {
  it("treats the same failure with different ids as one type", () => {
    expect(alertKey("undo:15 failed: boom")).toBe(alertKey("undo:9921 failed: boom"));
  });

  it("caps the key length", () => {
    expect(alertKey("x".repeat(500))).toHaveLength(80);
  });
});

describe("AlertThrottle", () => {
  it("sends the first alert, skips repeats inside the window and reports how many were skipped", () => {
    const t = new AlertThrottle();
    expect(t.take("a", 0)).toBe(0);
    expect(t.take("a", 1000)).toBeNull();
    expect(t.take("a", 2000)).toBeNull();
    expect(t.take("a", ALERT_WINDOW_MS)).toBe(2);
    expect(t.take("a", ALERT_WINDOW_MS + 1)).toBeNull();
  });

  it("throttles each type separately", () => {
    const t = new AlertThrottle();
    expect(t.take("a", 0)).toBe(0);
    expect(t.take("b", 1)).toBe(0);
  });
});

describe("ErrorTally", () => {
  it("returns the total and top types, then starts over", () => {
    const tally = new ErrorTally();
    ["a", "b", "a", "c", "a", "b"].forEach((k) => tally.add(k));
    expect(tally.drain(2)).toEqual({
      total: 6,
      top: [
        { key: "a", count: 3 },
        { key: "b", count: 2 },
      ],
    });
    expect(tally.drain()).toEqual({ total: 0, top: [] });
  });
});

describe("formatErrorAlert", () => {
  it("escapes HTML and truncates long messages", () => {
    const text = formatErrorAlert(`<b>${"x".repeat(600)}`, 0);
    expect(text).toContain("&lt;b&gt;");
    expect(text).toContain("…");
    expect(text).not.toContain("не отправлены");
  });

  it("mentions skipped repeats", () => {
    expect(formatErrorAlert("boom", 4)).toContain("Ещё 4 таких же");
  });
});

describe("isSummaryDue", () => {
  it("is due in the summary hour when not sent today", () => {
    expect(isSummaryDue(9, "2026-11-05", "2026-11-04")).toBe(true);
    expect(isSummaryDue(9, "2026-11-05", null)).toBe(true);
  });

  it("is not due outside the hour or twice a day", () => {
    expect(isSummaryDue(8, "2026-11-05", null)).toBe(false);
    expect(isSummaryDue(9, "2026-11-05", "2026-11-05")).toBe(false);
  });
});

describe("formatAdminSummary", () => {
  const base = {
    uptimeMs: 3 * 3600_000 + 5 * 60_000,
    memoryMb: 120,
    dbOk: true,
    rateLines: ["RUB свежий", "USD свежий"],
    errors: { total: 2, top: [{ key: "x <y>", count: 2 }] },
    activity: {
      usersTotal: 7,
      activeDay: 4,
      activeWeek: 6,
      transactionsDay: 12,
      txWeekBot: 30,
      txWeekWebapp: 11,
    },
  };

  it("shows uptime, activity and escaped error types", () => {
    const text = formatAdminSummary(base);
    expect(text).toContain("Аптайм: 3ч 5м");
    expect(text).toContain("Активных за сутки: 4, за неделю: 6 (всего 7)");
    expect(text).toContain("Операций за неделю: в чате 30, в мини-приложении 11");
    expect(text).toContain("2 × <code>x &lt;y&gt;</code>");
  });

  it("skips activity when the DB is down", () => {
    const text = formatAdminSummary({ ...base, dbOk: false, activity: null });
    expect(text).toContain("БД: недоступна");
    expect(text).not.toContain("Активных");
  });
});
