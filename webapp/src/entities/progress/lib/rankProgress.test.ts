import { describe, expect, it } from "vitest";
import { rankProgressPercent } from "./rankProgress";

describe("rankProgressPercent", () => {
  it("measures the share of the way between two ranks", () => {
    expect(rankProgressPercent(200, 100, 300)).toBe(50);
    expect(rankProgressPercent(100, 100, 300)).toBe(0);
  });
  it("clamps to 0–100 (xp can dip below the stored rank's threshold)", () => {
    expect(rankProgressPercent(50, 100, 300)).toBe(0);
    expect(rankProgressPercent(999, 100, 300)).toBe(100);
  });
  it("is full at the top rank", () => {
    expect(rankProgressPercent(7000, 6000, null)).toBe(100);
  });
});
