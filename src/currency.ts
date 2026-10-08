// Official exchange rates from the National Bank of Georgia (NBG).
// Rates are fetched at most once per Georgia calendar day and persisted in PostgreSQL.
// If NBG is unavailable, the last saved rates remain available as fallback.

import { pool } from "./db";
import { logger } from "./logger";
import { recordRateFallback } from "./metrics";
import {
  convertAmountBetween,
  effectiveRateToGel,
  isSupportedCurrency,
  SUPPORTED_CURRENCIES,
  SupportedCurrency,
} from "./currencies";

export type { SupportedCurrency };
export { SUPPORTED_CURRENCIES, isSupportedCurrency, convertAmountBetween };

const NBG_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/";
const FETCH_TIMEOUT_MS = 10000;
const TIME_ZONE = "Asia/Tbilisi";

interface RateEntry {
  rateToGel: number;
  fetchedAt: Date;
}

interface NbgCurrency {
  code: string;
  quantity: number;
  rate: number;
}

interface NbgDay {
  date: string;
  currencies: NbgCurrency[];
}

const cache = new Map<SupportedCurrency, RateEntry>();
cache.set("GEL", { rateToGel: 1, fetchedAt: new Date(0) });

function georgiaDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function loadRateCacheFromDb(): Promise<void> {
  try {
    const result = await pool.query<{
      currency: string;
      rate_to_gel: string;
      fetched_at: Date;
    }>("SELECT currency, rate_to_gel, fetched_at FROM rate_cache");
    for (const row of result.rows) {
      if (isSupportedCurrency(row.currency)) {
        const rate = Number(row.rate_to_gel);
        if (Number.isFinite(rate) && rate > 0) {
          cache.set(row.currency, { rateToGel: rate, fetchedAt: new Date(row.fetched_at) });
        }
      }
    }
    logger.info(`Loaded ${result.rows.length} cached exchange rate(s) from DB.`);
  } catch (err) {
    logger.warn(`Could not load rate cache from DB: ${(err as Error).message}`);
  }
}

async function persistRates(rates: Map<SupportedCurrency, number>, fetchedAt: Date): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [currency, rate] of rates) {
      await client.query(
        `INSERT INTO rate_cache (currency, rate_to_gel, fetched_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (currency) DO UPDATE SET rate_to_gel = EXCLUDED.rate_to_gel, fetched_at = EXCLUDED.fetched_at`,
        [currency, rate, fetchedAt],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function fetchRatesFromNbg(): Promise<Map<SupportedCurrency, number>> {
  const date = georgiaDate();
  const url = `${NBG_URL}?date=${date}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`NBG API HTTP ${response.status}`);
  const payload = (await response.json()) as NbgDay[];
  if (!Array.isArray(payload) || !payload[0] || !Array.isArray(payload[0].currencies)) {
    throw new Error("NBG API returned an unexpected response");
  }

  const result = new Map<SupportedCurrency, number>([["GEL", 1]]);
  for (const item of payload[0].currencies) {
    if (!isSupportedCurrency(item.code)) continue;
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(`NBG returned an invalid ${item.code} rate`);
    }
    result.set(item.code, rate / quantity);
  }
  for (const currency of SUPPORTED_CURRENCIES) {
    if (!result.has(currency)) throw new Error(`NBG response is missing ${currency}`);
  }
  return result;
}

export async function refreshRatesIfStale(): Promise<void> {
  const today = georgiaDate();
  const stale = SUPPORTED_CURRENCIES.some((currency) => {
    if (currency === "GEL") return false;
    const entry = cache.get(currency);
    return !entry || georgiaDate(entry.fetchedAt) !== today;
  });
  if (!stale) return;

  try {
    const fetched = await fetchRatesFromNbg();
    const fetchedAt = new Date();
    await persistRates(fetched, fetchedAt);
    for (const [currency, rate] of fetched) {
      cache.set(currency, { rateToGel: rate, fetchedAt });
    }
    logger.info(`Updated exchange rates from NBG for Georgia date ${today}.`);
  } catch (err) {
    logger.warn(`NBG rate refresh failed; using cached rates if available: ${(err as Error).message}`);
    recordRateFallback();
  }
}

export interface RateInfo {
  currency: SupportedCurrency;
  rateToGel: number | null;
  updatedAt: Date | null;
  isFallback: boolean;
}

export function getRateInfo(currency: SupportedCurrency): RateInfo {
  if (currency === "GEL") return { currency, rateToGel: 1, updatedAt: null, isFallback: false };
  const entry = cache.get(currency);
  if (!entry) return { currency, rateToGel: null, updatedAt: null, isFallback: false };
  return {
    currency,
    rateToGel: entry.rateToGel,
    updatedAt: entry.fetchedAt,
    isFallback: georgiaDate(entry.fetchedAt) !== georgiaDate(),
  };
}

export function getAllRateInfo(): RateInfo[] {
  return SUPPORTED_CURRENCIES.map(getRateInfo);
}

/**
 * `factor` is the user's exchanger factor (1 = official NBG rate). Callers that act on
 * behalf of a user pass settings.exchangeFactor; omitting it means the official rate.
 */
export function convertToGel(amount: number, currency: SupportedCurrency, factor = 1): number | null {
  const info = getRateInfo(currency);
  if (info.rateToGel === null) return null;
  return Math.round(amount * effectiveRateToGel(info.rateToGel, currency, factor) * 100) / 100;
}

/** Converts an amount from one supported currency to another using the live rate cache. */
export function convertBetween(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency,
  factor = 1,
): number | null {
  return convertAmountBetween(amount, from, to, (currency) => {
    const rate = getRateInfo(currency).rateToGel;
    return rate === null ? null : effectiveRateToGel(rate, currency, factor);
  });
}
