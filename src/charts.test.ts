import { describe, expect, it } from "vitest";
import { renderBarRow, renderShareList, renderTrendLine } from "./charts";

describe("renderBarRow", () => {
  it("fills the bar proportionally to fact/plan", () => {
    const text = renderBarRow("Еда", 100, 50, 10);
    expect(text).toContain("█████░░░░░");
    expect(text).toContain("50%");
  });

  it("caps the bar at full width when fact exceeds plan", () => {
    const text = renderBarRow("Еда", 100, 150, 10);
    expect(text).toContain("██████████");
    expect(text).toContain("150%");
  });

  it("never divides by zero when the plan is zero", () => {
    const withSpend = renderBarRow("Еда", 0, 20, 10);
    expect(withSpend).not.toContain("Infinity");
    expect(withSpend).not.toContain("NaN");
    expect(withSpend).toContain("план 0");

    const noSpend = renderBarRow("Еда", 0, 0, 10);
    expect(noSpend).not.toContain("NaN");
  });
});

describe("renderShareList", () => {
  it("sorts categories by amount descending", () => {
    const rows = renderShareList([
      { category: "Транспорт", amountGel: 50 },
      { category: "Еда", amountGel: 200 },
      { category: "Связь", amountGel: 100 },
    ]);
    expect(rows.map((r) => r.category)).toEqual(["Еда", "Связь", "Транспорт"]);
  });

  it("folds categories beyond topN into a non-drillable 'Прочее' bucket", () => {
    const rows = renderShareList(
      [
        { category: "A", amountGel: 40 },
        { category: "B", amountGel: 30 },
        { category: "C", amountGel: 20 },
        { category: "D", amountGel: 10 },
      ],
      2,
    );
    expect(rows).toHaveLength(3);
    expect(rows[2].label).toBe("Прочее");
    expect(rows[2].drillable).toBe(false);
    expect(rows[2].amountGel).toBe(30);
  });

  it("marks every real category as drillable", () => {
    const rows = renderShareList([{ category: "Еда", amountGel: 10 }]);
    expect(rows[0].drillable).toBe(true);
  });

  it("percentages sum to exactly 100 despite independent rounding drift", () => {
    // 1/3 each would naively round to 33+33+33 = 99.
    const rows = renderShareList([
      { category: "A", amountGel: 1 },
      { category: "B", amountGel: 1 },
      { category: "C", amountGel: 1 },
    ]);
    expect(rows.reduce((sum, r) => sum + r.percent, 0)).toBe(100);
  });

  it("returns all zero percentages for an all-zero (or empty) total instead of NaN", () => {
    const rows = renderShareList([
      { category: "A", amountGel: 0 },
      { category: "B", amountGel: 0 },
    ]);
    expect(rows.every((r) => r.percent === 0)).toBe(true);
    expect(renderShareList([])).toEqual([]);
  });

  it("labels a null category as 'Без категории' instead of dropping it", () => {
    const rows = renderShareList([{ category: null, amountGel: 10 }]);
    expect(rows[0].label).toBe("Без категории");
  });
});

describe("renderTrendLine", () => {
  it("reports no data for an empty series instead of crashing", () => {
    expect(renderTrendLine([])).toBe("Нет данных за период.");
  });

  it("handles a flat (all-equal) series without NaN", () => {
    const text = renderTrendLine([
      { label: "1", valueGel: 10 },
      { label: "2", valueGel: 10 },
    ]);
    expect(text).not.toContain("NaN");
  });

  it("includes the first and last labelled values", () => {
    const text = renderTrendLine([
      { label: "01.03", valueGel: 10 },
      { label: "02.03", valueGel: 50 },
    ]);
    expect(text).toContain("01.03");
    expect(text).toContain("02.03");
    expect(text).toContain("10.00 GEL");
    expect(text).toContain("50.00 GEL");
  });
});
