import { describe, expect, it } from "vitest";
import { isPaymentDueToday, nextDueDate } from "./paymentDueCheck";

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

describe("isPaymentDueToday in short months", () => {
  it("reminds a day-31 payment on the last day of a 30-day month", () => {
    expect(isPaymentDueToday(31, "2026-11-30", null)).toBe(true);
    expect(isPaymentDueToday(31, "2026-11-29", null)).toBe(false);
  });

  it("reminds day-29/30/31 payments on 28 February of a common year, 29 in a leap year", () => {
    expect(isPaymentDueToday(30, "2026-02-28", null)).toBe(true);
    expect(isPaymentDueToday(29, "2026-02-28", null)).toBe(true);
    expect(isPaymentDueToday(31, "2028-02-29", null)).toBe(true);
    expect(isPaymentDueToday(29, "2028-02-28", null)).toBe(false);
  });

  it("still sends only once that day", () => {
    expect(isPaymentDueToday(31, "2026-11-30", "2026-11-30")).toBe(false);
  });
});

describe("nextDueDate", () => {
  it("is today or later this month", () => {
    expect(nextDueDate(10, { year: 2026, month: 11, day: 4 })).toEqual({ iso: "2026-11-10", inDays: 6 });
    expect(nextDueDate(4, { year: 2026, month: 11, day: 4 })).toEqual({ iso: "2026-11-04", inDays: 0 });
  });

  it("moves to next month (and year) once the day has passed, clamping short months", () => {
    expect(nextDueDate(1, { year: 2026, month: 12, day: 15 })).toEqual({ iso: "2027-01-01", inDays: 17 });
    expect(nextDueDate(31, { year: 2026, month: 11, day: 4 })).toEqual({ iso: "2026-11-30", inDays: 26 });
    expect(nextDueDate(31, { year: 2027, month: 1, day: 31 })).toEqual({ iso: "2027-01-31", inDays: 0 });
    expect(nextDueDate(30, { year: 2027, month: 1, day: 31 })).toEqual({ iso: "2027-02-28", inDays: 28 });
  });
});
