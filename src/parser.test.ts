import { describe, expect, it } from "vitest";
import { isParseError, parseTransactionMessage } from "./parser";

describe("parseTransactionMessage", () => {
  it("parses an expense with currency, category and note", () => {
    const result = parseTransactionMessage("-150 rub еда обед");
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result).toEqual({
      type: "expense",
      amount: 150,
      currency: "RUB",
      category: "еда",
      note: "обед",
    });
  });

  it("parses an income and defaults currency to GEL when omitted", () => {
    const result = parseTransactionMessage("+2000 фриланс");
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result.type).toBe("income");
    expect(result.currency).toBe("GEL");
    expect(result.category).toBe("фриланс");
  });

  it("accepts a comma as the decimal separator", () => {
    const result = parseTransactionMessage("-12,50 usd подписка");
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result.amount).toBe(12.5);
  });

  it("tolerates extra surrounding whitespace", () => {
    const result = parseTransactionMessage("   -20   gel   транспорт   ");
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result.amount).toBe(20);
    expect(result.currency).toBe("GEL");
  });

  it("rejects an empty message", () => {
    const result = parseTransactionMessage("   ");
    expect(isParseError(result)).toBe(true);
  });

  it("rejects a zero amount", () => {
    const result = parseTransactionMessage("-0 gel еда");
    expect(isParseError(result)).toBe(true);
  });

  it("rejects a negative-looking amount after the sign token", () => {
    const result = parseTransactionMessage("не число");
    expect(isParseError(result)).toBe(true);
  });

  it("rejects an unknown three-letter currency token", () => {
    const result = parseTransactionMessage("-10 xyz еда");
    expect(isParseError(result)).toBe(true);
  });

  it("treats a non-currency first token as the category, not a currency", () => {
    const result = parseTransactionMessage("-10 еда обед");
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result.currency).toBe("GEL");
    expect(result.category).toBe("еда");
    expect(result.note).toBe("обед");
  });

  it("has no category or note when nothing follows the amount", () => {
    const result = parseTransactionMessage("-10 gel");
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result.category).toBeNull();
    expect(result.note).toBeNull();
  });
});
