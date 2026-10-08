import { describe, expect, it } from "vitest";
import { formatGel, formatInDisplay, formatMoney, percent } from "./money";

describe("percent", () => {
  it("rounds and caps at 100", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(500, 100)).toBe(100);
  });
  it("is 0 for a non-positive total", () => {
    expect(percent(5, 0)).toBe(0);
    expect(percent(5, -1)).toBe(0);
  });
});

describe("formatting", () => {
  it("always shows two decimals and the currency sign", () => {
    expect(formatGel(5)).toContain("5,00");
    expect(formatGel(5)).toContain("₾");
    expect(formatMoney(5, "RUB")).toContain("₽");
    expect(formatMoney(5, "USD")).toContain("$");
  });
  it("converts GEL into the main currency at the given rate", () => {
    expect(formatInDisplay(29.03, "RUB", 0.02903)).toContain("1");
    expect(formatInDisplay(29.03, "RUB", 0.02903)).toContain("₽");
  });
  it("falls back to GEL when the rate is unknown or the main currency is GEL", () => {
    expect(formatInDisplay(10, "RUB", null)).toContain("₾");
    expect(formatInDisplay(10, "GEL", 1)).toContain("₾");
  });
});
