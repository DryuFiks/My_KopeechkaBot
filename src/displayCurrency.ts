import { convertBetween } from "./currency";
import type { SupportedCurrency } from "./currencies";

export interface DisplayAmount {
  amount: number;
  currency: SupportedCurrency;
  /** false means the rate was unavailable and `amount`/`currency` fell back to the original GEL value — never a guessed number. */
  ok: boolean;
}

/**
 * Converts a GEL amount to a user's chosen display currency (MKB-013) for presentation
 * only — the underlying transaction/aggregate amounts always stay stored in GEL. Falls
 * back to GEL when the target currency's rate is unavailable, rather than inventing one.
 */
export function toDisplayCurrency(
  amountGel: number,
  displayCurrency: SupportedCurrency,
  factor = 1,
): DisplayAmount {
  if (displayCurrency === "GEL") return { amount: amountGel, currency: "GEL", ok: true };
  const converted = convertBetween(amountGel, "GEL", displayCurrency, factor);
  if (converted === null) return { amount: amountGel, currency: "GEL", ok: false };
  return { amount: converted, currency: displayCurrency, ok: true };
}
