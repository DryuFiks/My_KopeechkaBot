import { describe, expect, it } from "vitest";
import { isValidAmount, nextStep, previousStep } from "./steps";

describe("wizard steps", () => {
  it("moves currency → category → amount → confirm and stops at the ends", () => {
    expect(nextStep("currency")).toBe("category");
    expect(nextStep("category")).toBe("amount");
    expect(nextStep("amount")).toBe("confirm");
    expect(nextStep("confirm")).toBe("confirm");
    expect(previousStep("confirm")).toBe("amount");
    expect(previousStep("currency")).toBe("currency");
  });
});

describe("isValidAmount", () => {
  it("accepts positive finite amounts only", () => {
    expect(isValidAmount(25.5)).toBe(true);
    for (const bad of [0, -1, NaN, Infinity, 2_000_000_000]) expect(isValidAmount(bad)).toBe(false);
  });
});
