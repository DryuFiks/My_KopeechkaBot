export type Currency = "GEL" | "RUB" | "USD";

export const CURRENCY_SIGN: Record<Currency, string> = { GEL: "₾", RUB: "₽", USD: "$" };

function fmt(amount: number): string {
  return amount.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatGel(amount: number): string {
  return `${fmt(amount)} ${CURRENCY_SIGN.GEL}`;
}

export function formatMoney(amount: number, currency: Currency): string {
  return `${fmt(amount)} ${CURRENCY_SIGN[currency]}`;
}

/**
 * Показывает сумму, хранимую в GEL, в основной валюте пользователя.
 * `gelPerUnit` — сколько GEL стоит 1 единица этой валюты по курсу обменника; если курса нет,
 * честно показываем лари, а не выдуманное число.
 */
export function formatInDisplay(amountGel: number, currency: Currency, gelPerUnit: number | null): string {
  if (currency === "GEL" || gelPerUnit === null || gelPerUnit <= 0) return formatGel(amountGel);
  return formatMoney(amountGel / gelPerUnit, currency);
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}
