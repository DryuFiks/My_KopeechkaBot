import { describe, expect, it } from "vitest";
import { periodRange, previousPeriodRange } from "./period";

const NOW = new Date(2026, 2, 15); // 15 March 2026

describe("periodRange", () => {
  it("returns the current calendar month at offset 0", () => {
    const { from, to } = periodRange("month", 0, NOW);
    expect(from).toEqual(new Date(2026, 2, 1));
    expect(to).toEqual(new Date(2026, 3, 1));
  });

  it("returns the previous calendar month at offset -1, across a year boundary", () => {
    const { from, to } = periodRange("month", -1, new Date(2026, 0, 15));
    expect(from).toEqual(new Date(2025, 11, 1));
    expect(to).toEqual(new Date(2026, 0, 1));
  });

  it("returns the current calendar quarter at offset 0", () => {
    const { from, to } = periodRange("quarter", 0, NOW);
    expect(from).toEqual(new Date(2026, 0, 1));
    expect(to).toEqual(new Date(2026, 3, 1));
  });

  it("returns the previous quarter at offset -1, across a year boundary", () => {
    const { from, to } = periodRange("quarter", -1, new Date(2026, 0, 15));
    expect(from).toEqual(new Date(2025, 9, 1));
    expect(to).toEqual(new Date(2026, 0, 1));
  });

  it("returns the current calendar year at offset 0", () => {
    const { from, to } = periodRange("year", 0, NOW);
    expect(from).toEqual(new Date(2026, 0, 1));
    expect(to).toEqual(new Date(2027, 0, 1));
  });

  it("returns the previous year at offset -1", () => {
    const { from, to } = periodRange("year", -1, NOW);
    expect(from).toEqual(new Date(2025, 0, 1));
    expect(to).toEqual(new Date(2026, 0, 1));
  });
});

describe("previousPeriodRange", () => {
  it("is the same as periodRange one offset earlier", () => {
    expect(previousPeriodRange("month", 0, NOW)).toEqual(periodRange("month", -1, NOW));
    expect(previousPeriodRange("quarter", -1, NOW)).toEqual(periodRange("quarter", -2, NOW));
  });
});
