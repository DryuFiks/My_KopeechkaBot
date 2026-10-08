import { describe, expect, it } from "vitest";
import { suggestSplit } from "./split";

describe("suggestSplit", () => {
  it("splits 50/30/20", () => {
    expect(suggestSplit(3000)).toEqual({ essentials: 1500, discretionary: 900, savings: 600 });
  });
  it("rounds to cents", () => {
    expect(suggestSplit(0.01)).toEqual({ essentials: 0.01, discretionary: 0, savings: 0 });
  });
});
