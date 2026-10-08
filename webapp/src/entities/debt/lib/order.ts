import type { Debt } from "../model/types";

export type Strategy = "avalanche" | "snowball";

/** Avalanche — сначала самая высокая ставка (дешевле); snowball — сначала самый малый остаток (мотивирует). */
export function orderDebts(debts: Debt[], strategy: Strategy): Debt[] {
  const sorted = [...debts];
  sorted.sort((a, b) =>
    strategy === "avalanche" ? b.ratePercent - a.ratePercent : a.balanceGel - b.balanceGel,
  );
  return sorted;
}
