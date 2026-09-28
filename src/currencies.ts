// Pure currency-code data with no I/O — safe to import from anywhere,
// including unit tests, without pulling in the database pool.

export type SupportedCurrency = "RUB" | "GEL" | "USD";
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ["RUB", "GEL", "USD"];

export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as string[]).includes(code.toUpperCase());
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
