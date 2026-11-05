import { describe, expect, it } from "vitest";
import { pickMonth } from "./pickMonth";

// /api/history отдаёт месяцы от новых к старым (src/historyMonths.ts).
const months = [{ month: "2026-11" }, { month: "2026-10" }, { month: "2026-09" }];

describe("pickMonth", () => {
  it("opens the newest month by default and compares it with the month before", () => {
    expect(pickMonth(months, undefined)).toEqual({ selected: months[0], previous: months[1] });
  });

  it("compares a picked month with the one right before it in time", () => {
    expect(pickMonth(months, "2026-10")).toEqual({ selected: months[1], previous: months[2] });
  });

  it("has no previous month for the oldest one", () => {
    expect(pickMonth(months, "2026-09")).toEqual({ selected: months[2], previous: undefined });
  });

  it("falls back to the newest month when the picked one is gone", () => {
    expect(pickMonth(months, "2025-01").selected).toBe(months[0]);
  });

  it("returns nothing for an empty history", () => {
    expect(pickMonth([], undefined)).toEqual({ selected: undefined, previous: undefined });
  });
});
