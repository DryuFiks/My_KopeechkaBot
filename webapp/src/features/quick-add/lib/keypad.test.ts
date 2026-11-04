import { describe, expect, it } from "vitest";
import { pressKey, typeKeys } from "./keypad";

describe("pressKey", () => {
  it("builds a number digit by digit", () => {
    expect(typeKeys("125")).toBe("125");
  });

  it("replaces a lone leading zero", () => {
    expect(typeKeys("05")).toBe("5");
    expect(typeKeys("0,5")).toBe("0,5");
  });

  it("starts with 0 when the comma comes first and allows only one comma", () => {
    expect(typeKeys(",5")).toBe("0,5");
    expect(typeKeys("1,,2,")).toBe("1,2");
  });

  it("keeps at most two decimals and nine integer digits", () => {
    expect(typeKeys("3,999")).toBe("3,99");
    expect(typeKeys("1234567890")).toBe("123456789");
  });

  it("deletes the last character", () => {
    expect(pressKey("12,5", "back")).toBe("12,");
    expect(pressKey("7", "back")).toBe("");
    expect(pressKey("", "back")).toBe("");
  });
});
