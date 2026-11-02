import { describe, expect, it } from "vitest";
import { donutSlices } from "./donut";

describe("donutSlices", () => {
  it("lays arcs one after another around the ring", () => {
    expect(donutSlices([75, 25])).toEqual([
      { share: 75, start: 0 },
      { share: 25, start: 75 },
    ]);
  });

  it("gives no arc to empty or negative values", () => {
    expect(donutSlices([0, -5, 10])).toEqual([
      { share: 0, start: 0 },
      { share: 0, start: 0 },
      { share: 100, start: 0 },
    ]);
  });

  it("returns empty arcs when there is nothing to show", () => {
    expect(donutSlices([0, 0]).every((s) => s.share === 0)).toBe(true);
    expect(donutSlices([])).toEqual([]);
  });
});
