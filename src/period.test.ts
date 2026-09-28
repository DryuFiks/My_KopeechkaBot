import { describe, expect, it } from "vitest";
import { periodRange, previousPeriodRange } from "./period";

const TBILISI = "Asia/Tbilisi"; // fixed UTC+4, no DST — matches the function's own default
const NOW = new Date("2026-03-15T10:00:00Z"); // 2026-03-15 14:00 in Tbilisi

describe("periodRange", () => {
  it("returns the current calendar month at offset 0", () => {
    const { from, to } = periodRange("month", 0, NOW, TBILISI);
    expect(from.toISOString()).toBe("2026-02-28T20:00:00.000Z"); // 2026-03-01 00:00 +04:00
    expect(to.toISOString()).toBe("2026-03-31T20:00:00.000Z");
  });

  it("returns the previous calendar month at offset -1, across a year boundary", () => {
    const { from, to } = periodRange("month", -1, new Date("2026-01-15T10:00:00Z"), TBILISI);
    expect(from.toISOString()).toBe("2025-11-30T20:00:00.000Z");
    expect(to.toISOString()).toBe("2025-12-31T20:00:00.000Z");
  });

  it("returns the current calendar quarter at offset 0", () => {
    const { from, to } = periodRange("quarter", 0, NOW, TBILISI);
    expect(from.toISOString()).toBe("2025-12-31T20:00:00.000Z"); // 2026-01-01
    expect(to.toISOString()).toBe("2026-03-31T20:00:00.000Z"); // 2026-04-01
  });

  it("returns the previous quarter at offset -1, across a year boundary", () => {
    const { from, to } = periodRange("quarter", -1, new Date("2026-01-15T10:00:00Z"), TBILISI);
    expect(from.toISOString()).toBe("2025-09-30T20:00:00.000Z"); // 2025-10-01
    expect(to.toISOString()).toBe("2025-12-31T20:00:00.000Z"); // 2026-01-01
  });

  it("returns the current calendar year at offset 0", () => {
    const { from, to } = periodRange("year", 0, NOW, TBILISI);
    expect(from.toISOString()).toBe("2025-12-31T20:00:00.000Z"); // 2026-01-01
    expect(to.toISOString()).toBe("2026-12-31T20:00:00.000Z"); // 2027-01-01
  });

  it("returns the previous year at offset -1", () => {
    const { from, to } = periodRange("year", -1, NOW, TBILISI);
    expect(from.toISOString()).toBe("2024-12-31T20:00:00.000Z"); // 2025-01-01
    expect(to.toISOString()).toBe("2025-12-31T20:00:00.000Z"); // 2026-01-01
  });

  it("a user's timezone changes which calendar month 'now' falls into", () => {
    // 2026-03-01T02:00:00Z is already March in Tbilisi (+4) but still February in
    // New York (-5, before the March DST change) — the same instant, two different
    // "current months" depending on whose settings are used.
    const instant = new Date("2026-03-01T02:00:00Z");
    const tbilisiMonth = periodRange("month", 0, instant, "Asia/Tbilisi");
    const nyMonth = periodRange("month", 0, instant, "America/New_York");
    expect(tbilisiMonth.from.toISOString()).toBe("2026-02-28T20:00:00.000Z"); // March 1 in Tbilisi
    expect(nyMonth.from.toISOString()).toBe("2026-02-01T05:00:00.000Z"); // Feb 1 in New York
  });
});

describe("previousPeriodRange", () => {
  it("is the same as periodRange one offset earlier", () => {
    expect(previousPeriodRange("month", 0, NOW, TBILISI)).toEqual(periodRange("month", -1, NOW, TBILISI));
    expect(previousPeriodRange("quarter", -1, NOW, TBILISI)).toEqual(
      periodRange("quarter", -2, NOW, TBILISI),
    );
  });
});
