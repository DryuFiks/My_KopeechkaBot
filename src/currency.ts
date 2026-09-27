// Currency rates sourced from Google Finance quote pages.
// Google does not provide a supported public exchange-rate API, so this is
// best-effort HTML parsing and may need updating if Google changes its page.
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

// currency-converter-lt is CommonJS and does not include TypeScript declarations.
const CurrencyConverter = require("currency-converter-lt") as new (options?: unknown) => any;
const converter = new CurrencyConverter().setupRatesCache({
  isRatesCaching: true,
  ratesCacheDuration: 3600,
});

export type SupportedCurrency = "RUB" | "GEL" | "USD";
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ["RUB", "GEL", "USD"];

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 5000;
const CBR_URL = "https://www.cbr-xml-daily.com/latest.js";

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
      [currency, rate, fetchedAt],
    );
  } catch (err) {
    logger.warn(`Could not persist rate cache for ${currency}: ${(err as Error).message}`);
  }
}

async function fetchRatesFromConverter(currencies: SupportedCurrency[]): Promise<Map<SupportedCurrency, number>> {
  const result = new Map<SupportedCurrency, number>();

  for (const currency of currencies) {
    if (currency === "GEL") continue;

    // One unit of source currency converted to GEL gives our rate multiplier.
    logger.info(`Currency converter package: ${require("currency-converter-lt/package.json").version}`);

    const raw = await converter.from(currency).to("GEL").amount(1).convert();

    logger.info(`Currency debug ${currency}-GEL: raw=${String(raw)}, typeof=${typeof raw}, isNull=${raw === null}`);

    logger.info(`Currency debug ${currency}-GEL: ${JSON.stringify(raw)} (type: ${typeof raw})`);

    const rate = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`currency-converter-lt returned an invalid ${currency}-GEL rate: ${JSON.stringify(raw)}`);
    }

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`currency-converter-lt returned an invalid ${currency}-GEL rate`);
    }
    result.set(currency, rate);
  }
  return result;
}

export async function refreshRatesIfStale(): Promise<void> {
  const now = Date.now();
  const stale = SUPPORTED_CURRENCIES.filter((c) => {
    if (c === "GEL") return false;
    const entry = cache.get(c);
    return !entry || now - entry.fetchedAt.getTime() > CACHE_TTL_MS;
  });
  if (stale.length === 0) return;

  try {
    const fetched = await fetchRatesFromConverter(stale);
    const fetchedAt = new Date();
    for (const [currency, rate] of fetched.entries()) {
      cache.set(currency, { rateToGel: rate, fetchedAt });
      await persistRate(currency, rate, fetchedAt);
    }
    const missing = stale.filter((c) => !fetched.has(c));
    if (missing.length > 0) {
      logger.warn(`currency-converter-lt did not return rates for: ${missing.join(", ")}`);
    }
  } catch (err) {
    logger.warn(`currency-converter-lt rate refresh failed, using cached/fallback rates: ${(err as Error).message}`);
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
