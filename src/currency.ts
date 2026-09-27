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

export type SupportedCurrency = "RUB" | "GEL" | "USD";
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ["RUB", "GEL", "USD"];

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 5000;
const GOOGLE_FINANCE_URL = "https://www.google.com/finance/quote";

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

async function fetchRatesFromGoogleFinance(
  currencies: SupportedCurrency[]
): Promise<Map<SupportedCurrency, number>> {
  const result = new Map<SupportedCurrency, number>();

  // Google Finance quotes are expressed as units of the second currency per
  // one unit of the first (e.g. USD-GEL means GEL for 1 USD).
  for (const currency of currencies) {
    if (currency === "GEL") continue;

    const url = `${GOOGLE_FINANCE_URL}/${currency}-GEL?hl=en`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (!res.ok) {
        throw new Error(`Google Finance responded with HTTP ${res.status} for ${currency}-GEL`);
      }

      const html = await res.text();
      // Google Finance currently places the headline quote in a span named
      // Pdsbrc, after the pair label (e.g. "Russian Ruble / Georgian Lari").
      // Anchor the match to the expected pair so we don't accidentally parse
      // an unrelated number elsewhere in the page.
      const currencyNames: Record<Exclude<SupportedCurrency, "GEL">, string> = {
        RUB: "Russian Ruble",
        USD: "US Dollar",
      };
      const pairLabel = `${currencyNames[currency]}\\s*\/\\s*Georgian Lari`;
      const quotePattern = new RegExp(
        `<div[^>]*class="[^"]*gO24Ff[^"]*"[^>]*>\\s*${pairLabel}\\s*</div>[\\s\\S]{0,4000}?<span[^>]*jsname="Pdsbrc"[^>]*>\\s*<span[^>]*>\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*</span>`,
        "i"
      );
      const match = quotePattern.exec(html);
      let rate: number | null = null;
      if (match?.[1]) {
        const parsed = Number(match[1].replace(/,/g, ""));
        if (Number.isFinite(parsed) && parsed > 0) rate = parsed;
      }

      if (rate === null) {
        throw new Error(`Could not parse ${currency}-GEL quote from Google Finance`);
      }
      result.set(currency, rate);
    } finally {
      clearTimeout(timeout);
    }
  }

  return result;
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
    const fetched = await fetchRatesFromGoogleFinance(stale);
    const fetchedAt = new Date();
    for (const [currency, rate] of fetched.entries()) {
      cache.set(currency, { rateToGel: rate, fetchedAt });
      await persistRate(currency, rate, fetchedAt);
    }
    const missing = stale.filter((c) => !fetched.has(c));
    if (missing.length > 0) {
      logger.warn(`Google Finance did not return rates for: ${missing.join(", ")}`);
    }
  } catch (err) {
    logger.warn(
      `Google Finance rate refresh failed, using cached/fallback rates: ${(err as Error).message}`
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
