import type { Currency } from "@/shared/lib/money";

const KEY = "kb.lastCurrency";
const ALL: Currency[] = ["GEL", "RUB", "USD"];

/** Последняя валюта ввода — удобство на этом устройстве; хранилище может быть недоступно. */
export function readLastCurrency(): Currency | null {
  try {
    const v = localStorage.getItem(KEY);
    return ALL.includes(v as Currency) ? (v as Currency) : null;
  } catch {
    return null;
  }
}

export function saveLastCurrency(c: Currency): void {
  try {
    localStorage.setItem(KEY, c);
  } catch {
    // Нет хранилища — в следующий раз будет основная валюта.
  }
}
