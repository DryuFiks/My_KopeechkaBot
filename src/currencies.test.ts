import { describe, expect, it } from "vitest";
import {
  convertAmountBetween,
  effectiveRateToGel,
  isValidExchangeFactor,
  type SupportedCurrency,
} from "./currencies";

const fakeRates: Record<string, number | null> = { GEL: 1, USD: 2.7, RUB: 0.033 };
const rateToGel = (currency: string) => fakeRates[currency] ?? null;

describe("convertAmountBetween", () => {
  it("returns the same amount when converting a currency to itself", () => {
    expect(convertAmountBetween(100, "USD", "USD", rateToGel)).toBe(100);
  });

  it("converts to GEL directly using that currency's rate", () => {
    expect(convertAmountBetween(10, "USD", "GEL", rateToGel)).toBe(27);
  });

  it("converts from GEL directly using the target currency's rate", () => {
    expect(convertAmountBetween(27, "GEL", "USD", rateToGel)).toBe(10);
  });

  it("converts between two non-GEL currencies via GEL", () => {
    // 100 RUB -> 3.3 GEL -> 3.3 / 2.7 USD
    const result = convertAmountBetween(100, "RUB", "USD", rateToGel);
    expect(result).toBeCloseTo(1.22, 2);
  });

  it("returns null instead of a guessed number when the source rate is missing", () => {
    const missingRate = (currency: string) => (currency === "USD" ? null : fakeRates[currency]);
    expect(convertAmountBetween(10, "USD", "GEL", missingRate)).toBeNull();
  });

  it("returns null instead of a guessed number when the target rate is missing", () => {
    const missingRate = (currency: string) => (currency === "USD" ? null : fakeRates[currency]);
    expect(convertAmountBetween(10, "GEL", "USD", missingRate)).toBeNull();
  });

  it("returns null rather than dividing by a zero rate", () => {
    const zeroRate = (currency: string) => (currency === "USD" ? 0 : fakeRates[currency]);
    expect(convertAmountBetween(10, "GEL", "USD", zeroRate)).toBeNull();
  });
});

describe("exchanger factor", () => {
  it("lowers foreign currency value but never GEL", () => {
    expect(effectiveRateToGel(0.0323, "RUB", 0.9)).toBeCloseTo(0.02907, 5);
    expect(effectiveRateToGel(1, "GEL", 0.9)).toBe(1);
  });
  it("accepts only factors in [0.5, 1]", () => {
    expect(isValidExchangeFactor(0.9)).toBe(true);
    expect(isValidExchangeFactor(1)).toBe(true);
    expect(isValidExchangeFactor(0.4)).toBe(false);
    expect(isValidExchangeFactor(1.1)).toBe(false);
    expect(isValidExchangeFactor(NaN)).toBe(false);
  });
  it("keeps a round trip stable with the same effective rate", () => {
    const rates = (c: SupportedCurrency) => (c === "RUB" ? effectiveRateToGel(1 / 31, "RUB", 0.9) : 1);
    const gel = convertAmountBetween(1000, "RUB", "GEL", rates);
    expect(gel).toBe(29.03);
    expect(convertAmountBetween(gel!, "GEL", "RUB", rates)).toBeCloseTo(1000, -1);
  });
});
