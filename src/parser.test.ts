import { describe, expect, it } from "vitest";
import { isParseError, parseAmountLine, parseBareAmount, parseTransactionMessage } from "./parser";

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

describe("parseAmountLine", () => {
  it("parses a bare amount with no category — used to trigger the category picker", () => {
    const result = parseAmountLine("25 GEL");
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result).toEqual({ amount: 25, currency: "GEL", category: null, note: null });
  });

  it("parses amount, category and note together, skipping the category picker", () => {
    const result = parseAmountLine("25 GEL Еда обед");
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result.category).toBe("Еда");
    expect(result.note).toBe("обед");
  });

  it("does not require (or accept) a leading sign — the wizard already knows the type", () => {
    expect(isParseError(parseAmountLine("-25 GEL"))).toBe(true);
    expect(isParseError(parseAmountLine("+25 GEL"))).toBe(true);
  });

  it("defaults to GEL when no currency token is given", () => {
    const result = parseAmountLine("25 еда");
    expect(isParseError(result)).toBe(false);
    if (isParseError(result)) return;
    expect(result.currency).toBe("GEL");
    expect(result.category).toBe("еда");
  });

  it("rejects an empty message", () => {
    expect(isParseError(parseAmountLine("   "))).toBe(true);
  });

  it("rejects a zero or negative amount", () => {
    expect(isParseError(parseAmountLine("0 GEL"))).toBe(true);
  });
});

describe("parseBareAmount", () => {
  it("accepts plain numbers with dot or comma", () => {
    expect(parseBareAmount("25")).toBe(25);
    expect(parseBareAmount(" 25.5 ")).toBe(25.5);
    expect(parseBareAmount("25,50")).toBe(25.5);
    expect(parseBareAmount("1 250")).toBe(1250);
  });
  it("rejects zero, negatives, words and too many decimals", () => {
    for (const bad of ["0", "-5", "abc", "25 gel", "1.234", "", "1e5"]) {
      expect(isParseError(parseBareAmount(bad))).toBe(true);
    }
  });
  it("rejects absurdly large amounts", () => {
    expect(isParseError(parseBareAmount("99999999999"))).toBe(true);
  });
});
