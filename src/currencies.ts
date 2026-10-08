// Pure currency-code data with no I/O — safe to import from anywhere,
// including unit tests, without pulling in the database pool.

export type SupportedCurrency = "RUB" | "GEL" | "USD";
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ["RUB", "GEL", "USD"];

export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as string[]).includes(code.toUpperCase());
}

export const DEFAULT_EXCHANGE_FACTOR = 0.9;
export const MIN_EXCHANGE_FACTOR = 0.5;
export const MAX_EXCHANGE_FACTOR = 1;

/** True for a usable "exchanger" factor: official rate multiplied by a value in [0.5, 1]. */
export function isValidExchangeFactor(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_EXCHANGE_FACTOR && value <= MAX_EXCHANGE_FACTOR;
}

/**
 * The rate a user actually gets at an exchanger: foreign currency is worth `factor` times
 * its official value in GEL (factor 0.9 → 1000 ₽ buys 10% fewer lari). GEL itself is never
 * adjusted. The same effective rate is used in both directions so a round trip is stable
 * (1000 ₽ → GEL → ₽ gives 1000 ₽ again).
 */
export function effectiveRateToGel(
  officialRateToGel: number,
  currency: SupportedCurrency,
  factor: number,
): number {
  return currency === "GEL" ? officialRateToGel : officialRateToGel * factor;
}

/**
 * Pure conversion core: converts via GEL using whatever `rateToGel` function is given.
 * Separate from currency.ts's rate cache so it's testable with a fake rate table — no
 * cache, no DB, no network. Returns null (never a guessed number) if either currency's
 * rate is unavailable.
 */
export function convertAmountBetween(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency,
  rateToGel: (currency: SupportedCurrency) => number | null,
): number | null {
  if (from === to) return amount;
  const fromRate = rateToGel(from);
  if (fromRate === null) return null;
  const gel = amount * fromRate;
  if (to === "GEL") return Math.round(gel * 100) / 100;
  const toRate = rateToGel(to);
  if (toRate === null || toRate === 0) return null;
  return Math.round((gel / toRate) * 100) / 100;
}
