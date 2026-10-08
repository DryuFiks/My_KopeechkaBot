import { describe, expect, it } from "vitest";
import { projectMonthSpending, suggestBudgetSplit } from "./budgetRules";

describe("suggestBudgetSplit", () => {
  it("splits income 50/30/20 between essentials, discretionary and savings", () => {
    expect(suggestBudgetSplit(1000)).toEqual({
      essentialsGel: 500,
      discretionaryGel: 300,
      savingsGel: 200,
    });
  });

  it("the three shares add up to the whole income", () => {
    const split = suggestBudgetSplit(1234.56);
    const total = split.essentialsGel + split.discretionaryGel + split.savingsGel;
    expect(total).toBeCloseTo(1234.56, 2);
  });

  it("returns zero for zero income instead of dividing by anything", () => {
    expect(suggestBudgetSplit(0)).toEqual({ essentialsGel: 0, discretionaryGel: 0, savingsGel: 0 });
  });
});

describe("projectMonthSpending", () => {
  it("extrapolates the daily pace to the whole month", () => {
    expect(projectMonthSpending(300, 10, 30)).toBe(900);
  });
  it("returns null before any day elapsed and clamps elapsed days to the month", () => {
    expect(projectMonthSpending(100, 0, 30)).toBeNull();
    expect(projectMonthSpending(300, 40, 30)).toBe(300);
  });
});
