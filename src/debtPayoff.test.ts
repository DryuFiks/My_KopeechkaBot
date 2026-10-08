import { describe, expect, it } from "vitest";
import { simulatePayoff, totalMinimums, type PayoffDebt } from "./debtPayoff";

const d = (id: number, balanceGel: number, ratePercent: number, minPaymentGel: number): PayoffDebt => ({
  id,
  balanceGel,
  ratePercent,
  minPaymentGel,
});

describe("simulatePayoff", () => {
  it("clears a zero-rate debt in balance/budget months with no interest", () => {
    const plan = simulatePayoff([d(1, 1000, 0, 100)], 250, "avalanche");
    expect(plan.feasible).toBe(true);
    expect(plan.months).toBe(4);
    expect(plan.totalInterestGel).toBe(0);
    expect(plan.totalPaidGel).toBe(1000);
  });

  it("avalanche pays less interest than snowball when the big debt has the higher rate", () => {
    const debts = [d(1, 3000, 30, 50), d(2, 500, 5, 20)];
    const a = simulatePayoff(debts, 300, "avalanche");
    const s = simulatePayoff(debts, 300, "snowball");
    expect(a.totalInterestGel).toBeLessThan(s.totalInterestGel);
  });

  it("snowball clears the smallest balance first", () => {
    const plan = simulatePayoff([d(1, 3000, 30, 50), d(2, 500, 5, 20)], 300, "snowball");
    expect(plan.payoffOrder[0].id).toBe(2);
  });

  it("is infeasible when interest outruns the budget", () => {
    const plan = simulatePayoff([d(1, 10000, 60, 10)], 10, "avalanche");
    expect(plan.feasible).toBe(false);
  });

  it("ignores already-paid debts and handles an empty list", () => {
    expect(simulatePayoff([], 100, "avalanche").months).toBe(0);
    expect(simulatePayoff([d(1, 0, 10, 5)], 100, "snowball").months).toBe(0);
  });

  it("totalMinimums sums only open debts", () => {
    expect(totalMinimums([d(1, 100, 0, 30), d(2, 0, 0, 99), d(3, 5, 0, 10.5)])).toBe(40.5);
  });
});
