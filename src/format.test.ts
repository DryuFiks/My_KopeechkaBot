import { describe, expect, it } from "vitest";
import { formatMoney, formatPeriodLabel, formatSignedAmount, paginate, renderScreen } from "./format";

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
