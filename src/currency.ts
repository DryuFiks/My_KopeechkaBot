// V1 — Real currency rates.
// Source: National Bank of Georgia (NBG) official API — a natural fit since
// GEL is the base currency of this bot and the user is in Georgia.
// https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/
//
// Behavior:
// - Rates are cached in memory for 24h.
// - The cache is also persisted to the `rate_cache` table, so a restart
//   doesn't lose the last known rate (used as a fallback if the API is down).
// - If a rate is genuinely unavailable (fresh install, API down, no cache
//   yet), conversion returns null — callers must show this to the user
//   rather than inventing a value.

import { pool } from "./db";
import { logger } from "./logger";

export type SupportedCurrency = "RUB" | "GEL" | "USD";
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ["RUB", "GEL", "USD"];

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 5000;
const NBG_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/";

interface RateEntry {
  rateToGel: number;
  fetchedAt: Date;
}

const cache = new Map<SupportedCurrency, RateEntry>();
cache.set("GEL", { rateToGel: 1, fetchedAt: new Date(0) }); // GEL is always 1, never stale

export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as string[]).includes(code.toUpperCase());
}

/** Loads the last known rates from the DB at startup, so a restart keeps a usable fallback. */
export async function loadRateCacheFromDb(): Promise<void> {
  try {
    const result = await pool.query<{
      currency: string;
      rate_to_gel: string;
      fetched_at: Date;
    }>(`SELECT currency, rate_to_gel, fetched_at FROM rate_cache`);
    for (const row of result.rows) {
      if (isSupportedCurrency(row.currency)) {
        cache.set(row.currency as SupportedCurrency, {
          rateToGel: parseFloat(row.rate_to_gel),
          fetchedAt: row.fetched_at,
        });
      }
    }
    logger.info(`Loaded ${result.rows.length} cached exchange rate(s) from DB.`);
  } catch (err) {
    logger.warn(`Could not load rate cache from DB: ${(err as Error).message}`);
  }
}

async function persistRate(currency: SupportedCurrency, rate: number, fetchedAt: Date): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO rate_cache (currency, rate_to_gel, fetched_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (currency) DO UPDATE SET rate_to_gel = $2, fetched_at = $3`,
      [currency, rate, fetchedAt]
    );
  } catch (err) {
    logger.warn(`Could not persist rate cache for ${currency}: ${(err as Error).message}`);
  }
}

async function fetchRatesFromNbg(
  currencies: SupportedCurrency[]
): Promise<Map<SupportedCurrency, number>> {
  const url = `${NBG_URL}?currencies=${currencies.join(",")}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`NBG API responded with HTTP ${res.status}`);
    }
    const data = (await res.json()) as Array<{
      currencies: Array<{ code: string; quantity: number; rate: number }>;
    }>;
    const entries = data[0]?.currencies ?? [];

    const result = new Map<SupportedCurrency, number>();
    for (const entry of entries) {
      const code = entry.code.toUpperCase();
      if (isSupportedCurrency(code) && code !== "GEL" && entry.quantity > 0) {
        // NBG publishes "rate GEL per `quantity` units" — normalize to a per-unit rate.
        result.set(code as SupportedCurrency, entry.rate / entry.quantity);
      }
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Refreshes any currency whose cached rate is missing or older than 24h.
 * Never throws — on failure it logs a warning and leaves the existing
 * (possibly stale) cache in place, which callers treat as a fallback.
 */
export async function refreshRatesIfStale(): Promise<void> {
  const now = Date.now();
  const stale = SUPPORTED_CURRENCIES.filter((c) => {
    if (c === "GEL") return false;
    const entry = cache.get(c);
    return !entry || now - entry.fetchedAt.getTime() > CACHE_TTL_MS;
  });
  if (stale.length === 0) return;

  try {
    const fetched = await fetchRatesFromNbg(stale);
    const fetchedAt = new Date();
    for (const [currency, rate] of fetched.entries()) {
      cache.set(currency, { rateToGel: rate, fetchedAt });
      await persistRate(currency, rate, fetchedAt);
    }
    const missing = stale.filter((c) => !fetched.has(c));
    if (missing.length > 0) {
      logger.warn(`NBG API did not return rates for: ${missing.join(", ")}`);
    }
  } catch (err) {
    logger.warn(
      `Exchange rate refresh failed, using cached/fallback rates: ${(err as Error).message}`
    );
  }
}

export interface RateInfo {
  currency: SupportedCurrency;
  rateToGel: number | null;
  updatedAt: Date | null;
  /** true when this rate is older than the 24h cache window (API was unreachable). */
  isFallback: boolean;
}

export function getRateInfo(currency: SupportedCurrency): RateInfo {
  if (currency === "GEL") {
    return { currency, rateToGel: 1, updatedAt: null, isFallback: false };
  }
  const entry = cache.get(currency);
  if (!entry) {
    return { currency, rateToGel: null, updatedAt: null, isFallback: false };
  }
  const isFallback = Date.now() - entry.fetchedAt.getTime() > CACHE_TTL_MS;
  return { currency, rateToGel: entry.rateToGel, updatedAt: entry.fetchedAt, isFallback };
}

export function getAllRateInfo(): RateInfo[] {
  return SUPPORTED_CURRENCIES.map((c) => getRateInfo(c));
}

/**
 * Converts to GEL using the best available rate (fresh, or a stale cached
 * fallback). Returns null only when there is truly no rate on record yet —
 * callers must show that explicitly rather than storing a fabricated value.
 */
export function convertToGel(amount: number, currency: SupportedCurrency): number | null {
  const info = getRateInfo(currency);
  if (info.rateToGel === null) return null;
  return Math.round(amount * info.rateToGel * 100) / 100;
}
