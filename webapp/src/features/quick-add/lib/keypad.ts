export type Key = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "," | "back";

const MAX_INT_DIGITS = 9;
const MAX_DECIMALS = 2;

/** Сумма на своей клавиатуре: одна запятая, до 2 знаков после неё, без ведущих нулей. */
export function pressKey(value: string, key: Key): string {
  if (key === "back") return value.slice(0, -1);
  const [int, dec] = value.split(",");
  if (key === ",") return value.includes(",") ? value : `${value || "0"},`;
  if (dec !== undefined) return dec.length >= MAX_DECIMALS ? value : value + key;
  if (int === "0") return key;
  return int.length >= MAX_INT_DIGITS ? value : value + key;
}

/** Для тестов: последовательность нажатий строкой. */
export function typeKeys(keys: string): string {
  return [...keys].reduce((v, k) => pressKey(v, k as Key), "");
}
