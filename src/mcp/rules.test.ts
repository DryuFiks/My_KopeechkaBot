import { describe, expect, it } from "vitest";
import { generateToken, hashToken, isTokenShape } from "./tokens";
import {
  RateLimiter,
  reconcile,
  validAmount,
  validAsOf,
  validBalance,
  validateItem,
  type RawItem,
} from "./rules";

const NOW = new Date("2026-11-16T10:00:00Z");
const ctx = { knownCategories: ["Еда", "Транспорт"], timezone: "Asia/Tbilisi", now: NOW };
const base: RawItem = { type: "expense", amount: 12.5, currency: "GEL" };

describe("tokens", () => {
  it("makes distinct, well-formed tokens and a stable hash", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(isTokenShape(a)).toBe(true);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toHaveLength(64);
    expect(hashToken(a)).not.toBe(hashToken(b));
  });

  it("rejects junk before any DB lookup", () => {
    expect(isTokenShape("kb_mcp_short")).toBe(false);
    expect(isTokenShape("../../etc/passwd")).toBe(false);
    expect(isTokenShape(undefined)).toBe(false);
    expect(isTokenShape(`kb_mcp_${"a".repeat(43)}`)).toBe(true);
  });
});

describe("validateItem", () => {
  it("accepts a plain expense and normalises the currency", () => {
    const r = validateItem({ ...base, currency: "usd", note: "  кофе " }, ctx);
    expect(r).toMatchObject({
      ok: true,
      item: { amount: 12.5, currency: "USD", note: "кофе", category: null },
    });
  });

  it("maps a category to the stored spelling and rejects an unknown one", () => {
    const ok = validateItem({ ...base, category: "еда" }, ctx);
    expect(ok.ok && ok.item.category).toBe("Еда");
    const bad = validateItem({ ...base, category: "Яхты" }, ctx);
    expect(bad).toMatchObject({ ok: false });
    expect(!bad.ok && bad.error).toContain("list_categories");
  });

  it("rejects wrong type, amount and currency", () => {
    expect(validateItem({ ...base, type: "refund" }, ctx).ok).toBe(false);
    expect(validateItem({ ...base, amount: 0 }, ctx).ok).toBe(false);
    expect(validateItem({ ...base, amount: -5 }, ctx).ok).toBe(false);
    expect(validateItem({ ...base, amount: Number.NaN }, ctx).ok).toBe(false);
    expect(validateItem({ ...base, currency: "EUR" }, ctx).ok).toBe(false);
  });

  it("turns a date into noon in the user's timezone", () => {
    const r = validateItem({ ...base, date: "2026-11-10" }, ctx);
    // Asia/Tbilisi is UTC+4 → local noon = 08:00 UTC
    expect(r.ok && r.item.createdAt?.toISOString()).toBe("2026-11-10T08:00:00.000Z");
  });

  it("rejects future, impossible and ancient dates", () => {
    expect(validateItem({ ...base, date: "2026-11-20" }, ctx).ok).toBe(false);
    expect(validateItem({ ...base, date: "2026-02-31" }, ctx).ok).toBe(false);
    expect(validateItem({ ...base, date: "2015-01-01" }, ctx).ok).toBe(false);
    expect(validateItem({ ...base, date: "10.11.2026" }, ctx).ok).toBe(false);
  });

  it("limits note and external_id length", () => {
    expect(validateItem({ ...base, note: "x".repeat(201) }, ctx).ok).toBe(false);
    expect(validateItem({ ...base, external_id: "x".repeat(101) }, ctx).ok).toBe(false);
    const r = validateItem({ ...base, external_id: " tx-1 " }, ctx);
    expect(r.ok && r.item.externalId).toBe("tx-1");
  });
});

describe("amounts and balances", () => {
  it("validAmount: positive, two decimals, comma accepted", () => {
    expect(validAmount("12,345")).toBe(12.35);
    expect(validAmount(0)).toBeNull();
    expect(validAmount(2e9)).toBeNull();
  });

  it("validBalance allows zero and negative", () => {
    expect(validBalance(0)).toBe(0);
    expect(validBalance(-15.554)).toBe(-15.55);
    expect(validBalance("abc")).toBeNull();
  });

  it("validAsOf rejects the far future and garbage", () => {
    expect(validAsOf("2026-11-15T12:00:00Z", NOW)).toEqual(new Date("2026-11-15T12:00:00Z"));
    expect(validAsOf("2027-01-01", NOW)).toBeNull();
    expect(validAsOf("not a date", NOW)).toBeNull();
  });
});

describe("RateLimiter", () => {
  it("allows up to the limit inside the window and recovers after it", () => {
    const rl = new RateLimiter(10, 60_000);
    expect(rl.take("t", 6, 0)).toBe(true);
    expect(rl.take("t", 4, 1_000)).toBe(true);
    expect(rl.take("t", 1, 2_000)).toBe(false);
    expect(rl.take("t", 1, 61_000)).toBe(true); // first batch aged out
  });

  it("keeps tokens independent and takes nothing on refusal", () => {
    const rl = new RateLimiter(5, 60_000);
    expect(rl.take("a", 6, 0)).toBe(false);
    expect(rl.take("a", 5, 0)).toBe(true);
    expect(rl.take("b", 5, 0)).toBe(true);
  });
});

describe("reconcile", () => {
  const snap = (account: string, amountGel: number | null) => ({
    account,
    amount: amountGel ?? 0,
    currency: "GEL" as const,
    amountGel,
  });

  it("sums accounts and reports bank minus bot", () => {
    const r = reconcile([snap("TBC", 1000), snap("BoG", 250.5)], 1200);
    expect(r).toMatchObject({
      bankTotalGel: 1250.5,
      calculatedGel: 1200,
      differenceGel: 50.5,
      matches: false,
    });
  });

  it("matches within a cent and leaves unconverted accounts out", () => {
    const r = reconcile([snap("TBC", 100), snap("Cash USD", null)], 100);
    expect(r.matches).toBe(true);
    expect(r.notConverted).toEqual(["Cash USD"]);
  });
});
