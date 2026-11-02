import { describe, expect, it } from "vitest";
import { buildMonthRows, isMonthKey, nextMonthKey } from "./historyMonths";

const t = (month: string, incomeGel: number, expenseGel: number) => ({
  month,
  incomeGel,
  expenseGel,
  operations: 1,
});

describe("month keys", () => {
  it("validates and advances across a year boundary", () => {
    expect(isMonthKey("2026-11")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-1")).toBe(false);
    expect(nextMonthKey("2026-12")).toBe("2027-01");
    expect(nextMonthKey("2026-09")).toBe("2026-10");
  });
});

describe("buildMonthRows", () => {
  it("returns only the current month when there is no history", () => {
    expect(buildMonthRows([], "2026-11")).toEqual([
      { month: "2026-11", incomeGel: 0, expenseGel: 0, operations: 0, openingGel: 0, closingGel: 0 },
    ]);
  });
  it("fills gaps, carries the balance forward and lists newest first", () => {
    const rows = buildMonthRows([t("2026-09", 1000, 400), t("2026-11", 0, 85.5)], "2026-11");
    expect(rows.map((r) => r.month)).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(rows[2]).toMatchObject({ openingGel: 0, closingGel: 600 });
    expect(rows[1]).toMatchObject({ operations: 0, openingGel: 600, closingGel: 600 });
    expect(rows[0]).toMatchObject({ openingGel: 600, closingGel: 514.5 });
  });
});
