// M6 — Currency conversion (MVP: hardcoded, approximate rates).
// Sprint 2 (V1) will replace this with a real exchange-rate API + 24h cache.

export type SupportedCurrency = "RUB" | "GEL" | "USD";

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ["RUB", "GEL", "USD"];

// Rate = how many GEL one unit of the currency is worth.
// These are placeholder values — clearly marked as approximate to the user.
const RATES_TO_GEL: Record<SupportedCurrency, number> = {
  GEL: 1,
  RUB: 0.03,
  USD: 2.7,
};

export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as string[]).includes(code.toUpperCase());
}

/**
 * Converts an amount in the given currency to GEL.
 * Throws if the currency is not supported — callers must validate first
 * so an unknown currency never silently becomes 0.
 */
export function convertToGel(amount: number, currency: SupportedCurrency): number {
  const rate = RATES_TO_GEL[currency];
  if (rate === undefined) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  const result = amount * rate;
  return Math.round(result * 100) / 100;
}

/** Returns the current rate table, for /rate. */
export function getRates(): { currency: SupportedCurrency; rateToGel: number }[] {
  return SUPPORTED_CURRENCIES.map((currency) => ({
    currency,
    rateToGel: RATES_TO_GEL[currency],
  }));
}
