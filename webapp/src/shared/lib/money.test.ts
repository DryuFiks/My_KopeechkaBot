import { describe, expect, it } from "vitest";
import { formatGel, percent } from "./money";

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

describe("formatGel", () => {
  it("always shows two decimals and the lari sign", () => {
    expect(formatGel(5)).toContain("5,00");
    expect(formatGel(5)).toContain("₾");
  });
});
