import { describe, expect, it } from "vitest";
import { addMonths, toDateString } from "./date";

describe("addMonths", () => {
  it("adds whole months", () => {
    expect(toDateString(addMonths(new Date(2026, 9, 8), 6))).toBe("2027-04-08");
  });
  it("clamps to the last day of a shorter month", () => {
    expect(toDateString(addMonths(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
    expect(toDateString(addMonths(new Date(2028, 0, 31), 1))).toBe("2028-02-29");
  });
  it("crosses the year boundary", () => {
    expect(toDateString(addMonths(new Date(2026, 10, 15), 3))).toBe("2027-02-15");
  });
});

describe("toDateString", () => {
  it("zero-pads month and day in local time", () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
