import { describe, expect, it } from "vitest";
import {
  formatBalanceOverview,
  formatBudgetCategoryLine,
  formatDelta,
  formatMoney,
  formatPercentDelta,
  formatPeriodLabel,
  formatSignedAmount,
  paginate,
  renderScreen,
} from "./format";

describe("formatMoney", () => {
  it("always shows two decimals and the currency after the number", () => {
    expect(formatMoney(150, "GEL")).toBe("150.00 GEL");
    expect(formatMoney(12.5, "USD")).toBe("12.50 USD");
  });

  it("accepts a numeric string (as returned by pg NUMERIC columns)", () => {
    expect(formatMoney("99.9", "RUB")).toBe("99.90 RUB");
  });
});

describe("formatSignedAmount", () => {
  it("prefixes an expense with a minus and income with a plus", () => {
    expect(formatSignedAmount("expense", 20, "GEL")).toBe("-20.00 GEL");
    expect(formatSignedAmount("income", 20, "GEL")).toBe("+20.00 GEL");
  });
});

describe("formatPeriodLabel", () => {
  it("labels a single calendar day", () => {
    const from = new Date(2026, 2, 5);
    const to = new Date(2026, 2, 6);
    expect(formatPeriodLabel(from, to)).toBe("5 марта 2026");
  });

  it("labels a full calendar month", () => {
    const from = new Date(2026, 2, 1);
    const to = new Date(2026, 3, 1);
    expect(formatPeriodLabel(from, to)).toBe("Март 2026");
  });

  it("labels a full calendar month across a year boundary", () => {
    const from = new Date(2026, 11, 1);
    const to = new Date(2027, 0, 1);
    expect(formatPeriodLabel(from, to)).toBe("Декабрь 2026");
  });

  it("falls back to an inclusive date range otherwise", () => {
    const from = new Date(2026, 2, 5);
    const to = new Date(2026, 2, 12);
    expect(formatPeriodLabel(from, to)).toBe("05.03.2026 – 11.03.2026");
  });
});

describe("renderScreen", () => {
  it("bolds the title and joins lines", () => {
    expect(renderScreen({ title: "Заголовок", lines: ["первая", "вторая"] })).toBe(
      "<b>Заголовок</b>\nпервая\nвторая",
    );
  });

  it("shows the empty-state text with a suggested next action instead of a bare list", () => {
    expect(renderScreen({ title: "Пусто", lines: [], emptyText: "Ничего нет, добавь первую запись" })).toBe(
      "<b>Пусто</b>\nНичего нет, добавь первую запись",
    );
  });

  it("falls back to a generic message when no emptyText is given", () => {
    expect(renderScreen({ title: "Пусто", lines: [] })).toBe("<b>Пусто</b>\nПока нет данных.");
  });

  it("escapes HTML in the title", () => {
    expect(renderScreen({ title: "<script>", lines: [] })).toContain("&lt;script&gt;");
  });
});

describe("formatBalanceOverview", () => {
  it("shows a plain balance when every transaction converted to GEL", () => {
    expect(formatBalanceOverview({ totalGel: 123.4, unconvertedByCurrency: [] })).toBe("Остаток: 123.40 GEL");
  });

  it("labels the GEL total as excluding unconverted currencies and lists them separately", () => {
    const text = formatBalanceOverview({
      totalGel: 100,
      unconvertedByCurrency: [{ currency: "USD", amount: 15 }],
    });
    expect(text).toContain("Остаток (без валют без курса): 100.00 GEL");
    expect(text).toContain("15.00 USD");
  });

  it("never invents a single combined total when currencies could not be converted", () => {
    const text = formatBalanceOverview({
      totalGel: 0,
      unconvertedByCurrency: [
        { currency: "USD", amount: 15 },
        { currency: "RUB", amount: 300 },
      ],
    });
    expect(text).toContain("15.00 USD");
    expect(text).toContain("300.00 RUB");
  });
});

describe("formatDelta", () => {
  it("signs a positive change explicitly", () => {
    expect(formatDelta(50, "GEL")).toBe("+50.00 GEL");
  });

  it("keeps the minus sign already produced for a negative change", () => {
    expect(formatDelta(-50, "GEL")).toBe("-50.00 GEL");
  });

  it("shows a plain zero with no sign", () => {
    expect(formatDelta(0, "GEL")).toBe("0.00 GEL");
  });
});

describe("formatPercentDelta", () => {
  it("computes a signed percent change", () => {
    expect(formatPercentDelta(120, 100)).toBe("+20%");
    expect(formatPercentDelta(80, 100)).toBe("-20%");
  });

  it("returns 0% when both periods are zero, not NaN", () => {
    expect(formatPercentDelta(0, 0)).toBe("0%");
  });

  it("returns 'н/д' instead of Infinity when the previous period was zero", () => {
    expect(formatPercentDelta(100, 0)).toBe("н/д");
  });
});

describe("formatBudgetCategoryLine", () => {
  it("shows plan/fact and deviation in both currency and percent", () => {
    const text = formatBudgetCategoryLine({
      category: "Еда",
      limitGel: 300,
      effectiveLimitGel: 300,
      spentGel: 320,
      rollover: false,
    });
    expect(text).toContain("320.00 GEL / 300.00 GEL");
    expect(text).toContain("+20.00 GEL");
    expect(text).toContain("+7%");
  });

  it("shows a negative deviation when under budget", () => {
    const text = formatBudgetCategoryLine({
      category: "Еда",
      limitGel: 300,
      effectiveLimitGel: 300,
      spentGel: 250,
      rollover: false,
    });
    expect(text).toContain("-50.00 GEL");
    expect(text).toContain("-17%");
  });

  it("never divides by zero when the effective limit is zero", () => {
    const spent = formatBudgetCategoryLine({
      category: "Еда",
      limitGel: 0,
      effectiveLimitGel: 0,
      spentGel: 20,
      rollover: false,
    });
    expect(spent).not.toContain("Infinity");
    expect(spent).not.toContain("NaN");

    const zero = formatBudgetCategoryLine({
      category: "Еда",
      limitGel: 0,
      effectiveLimitGel: 0,
      spentGel: 0,
      rollover: false,
    });
    expect(zero).not.toContain("NaN");
  });

  it("labels a category with spending but no limit instead of omitting it", () => {
    const text = formatBudgetCategoryLine({
      category: "Такси",
      limitGel: null,
      effectiveLimitGel: null,
      spentGel: 45,
      rollover: false,
    });
    expect(text).toContain("45.00 GEL");
    expect(text).toContain("без лимита");
  });

  it("shows the rollover breakdown when the effective limit differs from the plain limit", () => {
    const text = formatBudgetCategoryLine({
      category: "Еда",
      limitGel: 300,
      effectiveLimitGel: 350,
      spentGel: 320,
      rollover: true,
    });
    expect(text).toContain("план 300.00 GEL");
    expect(text).toContain("перенос 50.00 GEL");
  });

  it("falls back to a neutral label when the transaction has no category", () => {
    const text = formatBudgetCategoryLine({
      category: null,
      limitGel: null,
      effectiveLimitGel: null,
      spentGel: 10,
      rollover: false,
    });
    expect(text).toContain("Без категории");
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  it("slices the requested page", () => {
    expect(paginate(items, 0, 10).items).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(paginate(items, 1, 10).items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(paginate(items, 2, 10).items).toEqual([20, 21, 22, 23, 24]);
  });

  it("computes the total page count", () => {
    expect(paginate(items, 0, 10).totalPages).toBe(3);
  });

  it("clamps an out-of-range page instead of returning an empty slice", () => {
    const result = paginate(items, 99, 10);
    expect(result.page).toBe(2);
    expect(result.items).toEqual([20, 21, 22, 23, 24]);
  });

  it("always reports at least one page for an empty list", () => {
    expect(paginate([], 0, 10)).toEqual({ items: [], page: 0, totalPages: 1 });
  });
});
