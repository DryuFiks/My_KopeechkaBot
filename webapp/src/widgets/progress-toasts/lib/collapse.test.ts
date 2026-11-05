import { describe, expect, it } from "vitest";
import { collapseToasts } from "./collapse";

describe("collapseToasts", () => {
  it("keeps up to two messages as they are", () => {
    expect(collapseToasts(["a"])).toEqual(["a"]);
    expect(collapseToasts(["a", "b"])).toEqual(["a", "b"]);
  });

  it("shows the first one and folds the rest into one line", () => {
    expect(collapseToasts(["a", "b", "c", "d"])).toEqual(["a", "🏅 И ещё 3 — все награды в Профиле"]);
  });
});
