import { describe, expect, it } from "vitest";
import { isValidTimeZone, zonedDayBoundaries, zonedMonthBoundaries, zonedToday } from "./timezone";

describe("isValidTimeZone", () => {
  it("accepts a real IANA identifier", () => {
    expect(isValidTimeZone("Asia/Tbilisi")).toBe(true);
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects a made-up identifier", () => {
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("zonedDayBoundaries", () => {
  it("computes a plain 24h day for a fixed-offset zone (no DST)", () => {
    // Asia/Tbilisi is UTC+4 year-round.
    const { from, to } = zonedDayBoundaries(new Date("2026-03-05T10:00:00Z"), "Asia/Tbilisi");
    expect(from.toISOString()).toBe("2026-03-04T20:00:00.000Z"); // 2026-03-05 00:00 +04:00
    expect(to.toISOString()).toBe("2026-03-05T20:00:00.000Z");
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("produces a 23-hour day across a spring-forward DST transition", () => {
    // US DST starts Sunday 8 March 2026, clocks jump 02:00 -> 03:00 local (America/New_York).
    const { from, to } = zonedDayBoundaries(new Date("2026-03-08T15:00:00Z"), "America/New_York");
    expect(from.toISOString()).toBe("2026-03-08T05:00:00.000Z"); // midnight EST (UTC-5)
    expect(to.toISOString()).toBe("2026-03-09T04:00:00.000Z"); // midnight EDT (UTC-4)
    expect(to.getTime() - from.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it("rolls over a month/year boundary correctly", () => {
    const { from, to } = zonedDayBoundaries(new Date("2025-12-31T22:00:00Z"), "Asia/Tbilisi");
    expect(from.toISOString()).toBe("2025-12-31T20:00:00.000Z");
    expect(to.toISOString()).toBe("2026-01-01T20:00:00.000Z");
  });
});

describe("zonedMonthBoundaries", () => {
  it("computes calendar month boundaries in the given zone", () => {
    const { from, to } = zonedMonthBoundaries(new Date("2026-03-15T10:00:00Z"), "Asia/Tbilisi");
    expect(from.toISOString()).toBe("2026-02-28T20:00:00.000Z"); // 2026-03-01 00:00 +04:00
    expect(to.toISOString()).toBe("2026-03-31T20:00:00.000Z"); // 2026-04-01 00:00 +04:00
  });

  it("rolls over a year boundary", () => {
    const { from, to } = zonedMonthBoundaries(new Date("2025-12-15T10:00:00Z"), "Asia/Tbilisi");
    expect(from.toISOString()).toBe("2025-11-30T20:00:00.000Z");
    expect(to.toISOString()).toBe("2025-12-31T20:00:00.000Z");
  });
});

describe("zonedToday", () => {
  it("reads the calendar date as seen in the given zone, not UTC", () => {
    // 2026-01-01T02:00:00Z is still 2025-12-31 in a UTC-4 zone.
    const result = zonedToday("America/New_York", new Date("2026-01-01T02:00:00Z"));
    expect(result).toEqual({ year: 2025, month: 12, day: 31 });
  });

  it("agrees with UTC for a UTC-based zone", () => {
    const result = zonedToday("UTC", new Date("2026-03-05T10:00:00Z"));
    expect(result).toEqual({ year: 2026, month: 3, day: 5 });
  });
});
