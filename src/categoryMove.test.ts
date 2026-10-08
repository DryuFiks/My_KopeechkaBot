import { describe, expect, it } from "vitest";
import { checkCategoryMove } from "./categoryMove";

describe("checkCategoryMove", () => {
  it("allows deleting an unused category without a target", () => {
    expect(checkCategoryMove("Еда", undefined, 0)).toEqual({ ok: true, moveTo: null });
    expect(checkCategoryMove("Еда", "Транспорт", 0)).toEqual({ ok: true, moveTo: null });
  });
  it("requires a target when operations exist", () => {
    expect(checkCategoryMove("Еда", "", 3)).toEqual({ ok: false, reason: "target_required" });
    expect(checkCategoryMove("Еда", undefined, 3)).toEqual({ ok: false, reason: "target_required" });
    expect(checkCategoryMove("Еда", "   ", 3)).toEqual({ ok: false, reason: "target_required" });
  });
  it("accepts an existing or brand-new target, trimmed", () => {
    expect(checkCategoryMove("Еда", "  Продукты ", 3)).toEqual({ ok: true, moveTo: "Продукты" });
  });
  it("refuses moving a category into itself", () => {
    expect(checkCategoryMove("Еда", "Еда", 3)).toEqual({ ok: false, reason: "same_category" });
  });
  it("rejects empty or over-long names", () => {
    expect(checkCategoryMove("", "Х", 1)).toEqual({ ok: false, reason: "invalid_from" });
    expect(checkCategoryMove(42, "Х", 1)).toEqual({ ok: false, reason: "invalid_from" });
    expect(checkCategoryMove("Еда", "я".repeat(61), 1)).toEqual({ ok: false, reason: "invalid_target" });
  });
});
