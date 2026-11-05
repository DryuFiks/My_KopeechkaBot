import { describe, expect, it } from "vitest";
import {
  dayProgress,
  daysLeftInMonth,
  expectedMonthlyAmount,
  factAllowance,
  freeMoney,
  suggestCategoryLimits,
  suggestGoalTemplates,
  suggestMonthlyContribution,
  todayAllowance,
} from "./monthPlan";

describe("expectedMonthlyAmount", () => {
  it("fixed uses the amount", () => {
    expect(
      expectedMonthlyAmount({ mode: "fixed", amount: 1500, minAmount: null, maxAmount: null }, null, []),
    ).toBe(1500);
  });
  it("range uses the average of min and max, whichever order they were typed", () => {
    const src = { mode: "range", amount: null, minAmount: 1000, maxAmount: 2000 } as const;
    expect(expectedMonthlyAmount(src, null, [])).toBe(1500);
    expect(expectedMonthlyAmount({ ...src, minAmount: 2000, maxAmount: 1000 }, null, [])).toBe(1500);
  });
  it("actual prefers this month's receipt, then averages up to 3 previous months, then 0", () => {
    const src = { mode: "actual", amount: null, minAmount: null, maxAmount: null } as const;
    expect(expectedMonthlyAmount(src, 900, [100, 200])).toBe(900);
    expect(expectedMonthlyAmount(src, null, [300, 600, 900, 99999])).toBe(600);
    expect(expectedMonthlyAmount(src, null, [])).toBe(0);
  });
});

describe("daysLeftInMonth", () => {
  it("counts today and the rest of the month in the user's timezone", () => {
    expect(daysLeftInMonth(new Date("2026-10-08T12:00:00Z"), "Asia/Tbilisi")).toBe(24);
    expect(daysLeftInMonth(new Date("2026-10-31T12:00:00Z"), "Asia/Tbilisi")).toBe(1);
  });
});

describe("freeMoney / todayAllowance", () => {
  it("free = income − mandatory", () => {
    expect(freeMoney(3000, 1400)).toBe(1600);
  });
  it("reserves mandatory payments until spending passes them", () => {
    const a = todayAllowance({
      incomeGel: 3000,
      mandatoryGel: 1400,
      expenseSoFarGel: 500,
      daysLeft: 20,
      daysInMonth: 30,
    });
    expect(a.remainingGel).toBe(1600);
    expect(a.perDayGel).toBe(80);
    expect(a.status).toBe("ok");
  });
  it("counts spending beyond the mandatory total as optional", () => {
    const a = todayAllowance({
      incomeGel: 3000,
      mandatoryGel: 1400,
      expenseSoFarGel: 2000,
      daysLeft: 10,
      daysInMonth: 30,
    });
    expect(a.remainingGel).toBe(1000);
    expect(a.perDayGel).toBe(100);
  });
  it("flags a tight and an exhausted month", () => {
    const tight = todayAllowance({
      incomeGel: 3000,
      mandatoryGel: 1400,
      expenseSoFarGel: 2900,
      daysLeft: 20,
      daysInMonth: 30,
    });
    expect(tight.status).toBe("tight");
    const over = todayAllowance({
      incomeGel: 3000,
      mandatoryGel: 1400,
      expenseSoFarGel: 3200,
      daysLeft: 5,
      daysInMonth: 30,
    });
    expect(over).toEqual({ remainingGel: -200, perDayGel: 0, status: "over" });
  });
});

describe("factAllowance", () => {
  const base = {
    carryOverGel: 0,
    factIncomeGel: 0,
    plannedIncomeGel: 3000,
    mandatoryGel: 1400,
    expenseSoFarGel: 0,
    daysLeft: 20,
    daysInMonth: 30,
  };
  it("does not count the planned income that has not been received", () => {
    const a = factAllowance({ ...base, expenseSoFarGel: 85.5 });
    expect(a).toEqual({ remainingGel: -1400, perDayGel: 0, status: "over" });
  });
  it("counts the carried-over balance and received income", () => {
    const a = factAllowance({ ...base, carryOverGel: 600, factIncomeGel: 2000, expenseSoFarGel: 500 });
    expect(a.remainingGel).toBe(1200);
    expect(a.perDayGel).toBe(60);
    expect(a.status).toBe("ok");
  });
  it("counts spending beyond the mandatory total as optional", () => {
    const a = factAllowance({ ...base, factIncomeGel: 3000, expenseSoFarGel: 2000, daysLeft: 10 });
    expect(a.remainingGel).toBe(1000);
    expect(a.perDayGel).toBe(100);
  });
  it("flags a tight month", () => {
    expect(factAllowance({ ...base, factIncomeGel: 3000, expenseSoFarGel: 2900 }).status).toBe("tight");
  });
});

describe("suggestions", () => {
  it("contributes at most 20% of free money and nothing when there is none", () => {
    expect(suggestMonthlyContribution(1600)).toBe(320);
    expect(suggestMonthlyContribution(-50)).toBe(0);
    expect(suggestMonthlyContribution(0)).toBe(0);
  });
  it("sizes the cushion as 3 months of mandatory expenses", () => {
    const [cushion] = suggestGoalTemplates(1400, 1600);
    expect(cushion.targetGel).toBe(4200);
    expect(cushion.monthlyGel).toBe(320);
    expect(cushion.months).toBe(14);
  });
  it("has no timeline when nothing can be saved", () => {
    expect(suggestGoalTemplates(1400, 0).every((g) => g.monthlyGel === 0 && g.months === 0)).toBe(true);
  });
  it("splits the non-savings 80% across categories", () => {
    const limits = suggestCategoryLimits(1000);
    expect(limits.reduce((s, l) => s + l.limitGel, 0)).toBeCloseTo(800, 1);
    expect(suggestCategoryLimits(0)).toEqual([]);
  });
});

describe("dayProgress", () => {
  it("subtracts today's spending from the amount fixed at the start of the day", () => {
    expect(dayProgress(200, 50)).toEqual({ allowanceGel: 200, spentGel: 50, leftGel: 150, share: 0.25 });
  });

  it("goes negative and caps the ring when today is over", () => {
    expect(dayProgress(100, 130)).toEqual({ allowanceGel: 100, spentGel: 130, leftGel: -30, share: 1 });
  });

  it("handles no allowance at all", () => {
    expect(dayProgress(0, 0).share).toBe(0);
    expect(dayProgress(-20, 10)).toEqual({ allowanceGel: 0, spentGel: 10, leftGel: -10, share: 1 });
  });

  it("rounds to cents", () => {
    expect(dayProgress(200.934, 10.004).leftGel).toBe(190.93);
  });
});
