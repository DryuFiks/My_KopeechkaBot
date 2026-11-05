import { describe, expect, it } from "vitest";
import { parseTransactionFilter } from "./transactionSearch";

describe("parseTransactionFilter", () => {
  it("is empty when nothing is asked", () => {
    expect(parseTransactionFilter(undefined, undefined)).toEqual({ pattern: null, type: null });
    expect(parseTransactionFilter("   ", "all")).toEqual({ pattern: null, type: null });
  });

  it("turns text into a case-insensitive contains-pattern", () => {
    expect(parseTransactionFilter("  кафе ", undefined).pattern).toBe("%кафе%");
  });

  it("searches %, _ and backslash literally", () => {
    expect(parseTransactionFilter("50%_off\\", undefined).pattern).toBe("%50\\%\\_off\\\\%");
  });

  it("caps the query length", () => {
    expect(parseTransactionFilter("x".repeat(200), undefined).pattern).toBe(`%${"x".repeat(60)}%`);
  });

  it("accepts only known types", () => {
    expect(parseTransactionFilter(undefined, "income").type).toBe("income");
    expect(parseTransactionFilter(undefined, "expense").type).toBe("expense");
    expect(parseTransactionFilter(undefined, "anything").type).toBeNull();
  });
});
