import { describe, expect, it } from "vitest";
import { isPaymentDueToday } from "./paymentDueCheck";

describe("isPaymentDueToday", () => {
  it("is due when today's day-of-month matches and it hasn't been notified yet", () => {
    expect(isPaymentDueToday(5, "2026-03-05", null)).toBe(true);
  });

  it("is not due when today's day-of-month doesn't match", () => {
    expect(isPaymentDueToday(5, "2026-03-06", null)).toBe(false);
  });

  it("is not due again if already notified today", () => {
    expect(isPaymentDueToday(5, "2026-03-05", "2026-03-05")).toBe(false);
  });

  it("is due again on the due day of a later month even if notified on a past due day", () => {
    expect(isPaymentDueToday(5, "2026-04-05", "2026-03-05")).toBe(true);
  });

  it("is due on day 31 for a month that only reached day 30 last time", () => {
    // Guards against a naive "day equals stored day" check being fooled by short months.
    expect(isPaymentDueToday(31, "2026-03-31", "2026-02-28")).toBe(true);
  });
});
