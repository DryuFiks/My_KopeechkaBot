import { describe, expect, it } from "vitest";
import { editedOperationTime, parseIsoDate, recomputeAmountGel } from "./transactionEdit";

describe("recomputeAmountGel", () => {
  const base = { oldAmount: 1000, oldCurrency: "RUB" as const, oldAmountGel: 29, todayGel: 31 };

  it("keeps the original rate when only the amount changes", () => {
    expect(recomputeAmountGel({ ...base, newAmount: 2000, newCurrency: "RUB" })).toBe(58);
  });

  it("uses today's rate when the currency changes", () => {
    expect(recomputeAmountGel({ ...base, newAmount: 10, newCurrency: "USD", todayGel: 27.1 })).toBe(27.1);
  });

  it("GEL is always 1:1", () => {
    expect(recomputeAmountGel({ ...base, newAmount: 12.345, newCurrency: "GEL" })).toBe(12.35);
  });

  it("falls back to today's rate when the old operation had no GEL value, and to null without a rate", () => {
    expect(
      recomputeAmountGel({ ...base, oldAmountGel: null, newAmount: 500, newCurrency: "RUB", todayGel: 15 }),
    ).toBe(15);
    expect(
      recomputeAmountGel({ ...base, oldAmountGel: null, newAmount: 500, newCurrency: "RUB", todayGel: null }),
    ).toBeNull();
  });
});

describe("editedOperationTime", () => {
  const today = new Date("2026-11-04T20:00:00Z"); // local midnight of 5 Nov in Tbilisi (UTC+4)

  it("moves the operation to noon of the picked day", () => {
    const day = new Date("2026-11-01T20:00:00Z");
    expect(editedOperationTime(day, today)?.toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  it("allows today and rejects the future", () => {
    expect(editedOperationTime(today, today)).not.toBeNull();
    expect(editedOperationTime(new Date("2026-11-05T20:00:00Z"), today)).toBeNull();
  });

  it("rejects dates more than five years back", () => {
    expect(editedOperationTime(new Date("2020-01-01T00:00:00Z"), today)).toBeNull();
  });
});

describe("parseIsoDate", () => {
  it("accepts real dates only", () => {
    expect(parseIsoDate("2026-02-28")).toEqual({ year: 2026, month: 2, day: 28 });
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("2026-2-3")).toBeNull();
    expect(parseIsoDate(20260203)).toBeNull();
  });
});
