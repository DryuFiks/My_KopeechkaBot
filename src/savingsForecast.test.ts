import { describe, expect, it } from "vitest";
import { averageMonthlySavings, monthsToGoal, requiredMonthly } from "./savingsForecast";

const NOW = new Date("2026-01-01T00:00:00Z");

describe("monthsToGoal", () => {
  it("rounds up to whole months", () => {
    expect(monthsToGoal(1000, 300)).toBe(4);
  });
  it("is 0 for a reached goal and null for a zero pace", () => {
    expect(monthsToGoal(0, 0)).toBe(0);
    expect(monthsToGoal(-5, 100)).toBe(0);
    expect(monthsToGoal(500, 0)).toBeNull();
  });
});

describe("requiredMonthly", () => {
  it("is null without a target date", () => {
    expect(requiredMonthly(500, null, NOW)).toBeNull();
  });
  it("splits the remainder over the months left", () => {
    const r = requiredMonthly(1200, new Date("2026-07-01T00:00:00Z"), NOW);
    expect(r).toEqual({ monthsLeft: 6, perMonthGel: 200, overdue: false });
  });
  it("marks a past date as overdue", () => {
    const r = requiredMonthly(300, new Date("2025-12-01T00:00:00Z"), NOW);
    expect(r?.overdue).toBe(true);
    expect(r?.perMonthGel).toBe(300);
  });
  it("needs nothing once the goal is reached", () => {
    expect(requiredMonthly(0, new Date("2026-07-01T00:00:00Z"), NOW)).toEqual({
      monthsLeft: 0,
      perMonthGel: 0,
      overdue: false,
    });
  });
});

describe("averageMonthlySavings", () => {
  it("averages the surplus and clamps losses to zero", () => {
    expect(averageMonthlySavings(3000, 1800, 3)).toBe(400);
    expect(averageMonthlySavings(1000, 2000, 3)).toBe(0);
    expect(averageMonthlySavings(1000, 0, 0)).toBe(0);
  });
});
