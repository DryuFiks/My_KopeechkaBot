// Pure rules for operations that come from an AI agent (MKB-063) — no DB, testable as is.
// The I/O shell is src/mcp/server.ts (tools) + src/mcp/deps.ts (database).

import { isSupportedCurrency, type SupportedCurrency } from "../currencies";
import { editedOperationTime, parseIsoDate } from "../transactionEdit";
import { zonedDateBoundary, zonedDayBoundaries } from "../timezone";
import type { TransactionType } from "../parser";

export const MAX_BATCH = 50;
export const MAX_AMOUNT = 1e9;
export const MAX_NOTE = 200;
export const MAX_CATEGORY = 50;
export const MAX_EXTERNAL_ID = 100;
export const MAX_ACCOUNT = 50;
/** Records one token may write per minute (a month of a busy account fits in a couple of calls). */
export const WRITES_PER_MINUTE = 100;

export interface RawItem {
  type?: unknown;
  amount?: unknown;
  currency?: unknown;
  category?: unknown;
  note?: unknown;
  date?: unknown;
  external_id?: unknown;
}

export interface ValidItem {
  type: TransactionType;
  amount: number;
  currency: SupportedCurrency;
  category: string | null;
  note: string | null;
  createdAt: Date | null;
  externalId: string | null;
}

export type ItemResult = { ok: true; item: ValidItem } | { ok: false; error: string };

const round2 = (v: number): number => Math.round(v * 100) / 100;

function text(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (t.length > max) return undefined;
  return t === "" ? null : t;
}

/** Amount as a positive number with two decimals, or null if it isn't one. */
export function validAmount(value: unknown, { allowNegative = false } = {}): number | null {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > MAX_AMOUNT) return null;
  if (n === 0 || (n < 0 && !allowNegative)) return null;
  return round2(n);
}

/** A bank balance: any sign (overdraft), zero allowed, two decimals; null if it isn't a number. */
export function validBalance(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > MAX_AMOUNT) return null;
  return round2(n);
}

/** `as_of` of a balance snapshot: any ISO date/time that is not more than a day ahead. */
export function validAsOf(value: unknown, now: Date): Date | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  if (Number.isNaN(t) || t > now.getTime() + 86_400_000) return null;
  return new Date(t);
}

/**
 * One operation from `add_transactions` → ready to store, or a message the agent can act on.
 * `knownCategories` are the user's own names: an unknown one is rejected (it would silently
 * pollute the statistics), but a differently-cased match is mapped to the stored spelling.
 */
export function validateItem(
  raw: RawItem,
  ctx: { knownCategories: string[]; timezone: string; now: Date },
): ItemResult {
  if (raw.type !== "expense" && raw.type !== "income") return fail('type must be "expense" or "income"');
  const amount = validAmount(raw.amount);
  if (amount === null) return fail("amount must be a positive number (sign is given by type)");
  if (typeof raw.currency !== "string" || !isSupportedCurrency(raw.currency))
    return fail("currency must be one of RUB, GEL, USD");

  const note = text(raw.note, MAX_NOTE);
  if (note === undefined) return fail(`note must be a string up to ${MAX_NOTE} characters`);
  const externalId = text(raw.external_id, MAX_EXTERNAL_ID);
  if (externalId === undefined)
    return fail(`external_id must be a string up to ${MAX_EXTERNAL_ID} characters`);

  let category = text(raw.category, MAX_CATEGORY);
  if (category === undefined) return fail(`category must be a string up to ${MAX_CATEGORY} characters`);
  if (category !== null) {
    const wanted = category.toLowerCase();
    const match = ctx.knownCategories.find((c) => c.toLowerCase() === wanted);
    if (!match) return fail(`unknown category "${category}": call list_categories and use one of its names`);
    category = match;
  }

  let createdAt: Date | null = null;
  if (raw.date !== undefined && raw.date !== null) {
    createdAt = operationTime(raw.date, ctx.timezone, ctx.now);
    if (!createdAt) return fail("date must be a real YYYY-MM-DD day, not in the future and within 5 years");
  }

  return {
    ok: true,
    item: {
      type: raw.type,
      amount,
      currency: raw.currency.toUpperCase() as SupportedCurrency,
      category,
      note,
      createdAt,
      externalId,
    },
  };
}

function fail(error: string): ItemResult {
  return { ok: false, error };
}

/** "YYYY-MM-DD" → noon of that day in the user's timezone (same rule as editing in the WebApp). */
export function operationTime(date: unknown, timezone: string, now: Date): Date | null {
  const d = parseIsoDate(date);
  if (!d) return null;
  const dayStart = zonedDateBoundary(d.year, d.month, d.day, timezone);
  return editedOperationTime(dayStart, zonedDayBoundaries(now, timezone).from);
}

/** Sliding one-minute window per key; `now` is injectable so tests need no timers. */
export class RateLimiter {
  private readonly hits = new Map<string, { at: number; n: number }[]>();

  constructor(
    private readonly limit: number = WRITES_PER_MINUTE,
    private readonly windowMs = 60_000,
  ) {}

  /** Takes `n` units for `key`; false (and nothing taken) when that would exceed the limit. */
  take(key: string, n = 1, now: number = Date.now()): boolean {
    const fresh = (this.hits.get(key) ?? []).filter((h) => now - h.at < this.windowMs);
    const used = fresh.reduce((sum, h) => sum + h.n, 0);
    if (used + n > this.limit) {
      this.hits.set(key, fresh);
      return false;
    }
    fresh.push({ at: now, n });
    this.hits.set(key, fresh);
    return true;
  }
}

export interface BalanceSnapshot {
  account: string;
  amount: number;
  currency: SupportedCurrency;
  amountGel: number | null;
}

export interface Reconciliation {
  bankTotalGel: number;
  calculatedGel: number;
  /** bank − calculated: positive means the bank holds more than the bot has recorded. */
  differenceGel: number;
  matches: boolean;
  /** Accounts whose GEL value is unknown (no rate) — left out of the total, never guessed. */
  notConverted: string[];
}

/** Bank balances (latest snapshot per account) vs. the bot's income-minus-expense balance, in GEL. */
export function reconcile(latest: BalanceSnapshot[], calculatedGel: number): Reconciliation {
  const converted = latest.filter((s) => s.amountGel !== null);
  const bankTotalGel = round2(converted.reduce((sum, s) => sum + (s.amountGel as number), 0));
  const differenceGel = round2(bankTotalGel - calculatedGel);
  return {
    bankTotalGel,
    calculatedGel: round2(calculatedGel),
    differenceGel,
    matches: Math.abs(differenceGel) < 0.01,
    notConverted: latest.filter((s) => s.amountGel === null).map((s) => s.account),
  };
}
