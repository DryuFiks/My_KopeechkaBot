// V4 — single formatting mode chosen: Telegram HTML parse_mode.
// Any user-supplied text (category, note) MUST go through escapeHtml before
// being embedded in a reply, so brackets/asterisks/underscores in notes
// never break the markup.

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const PARSE_MODE = "HTML" as const;

/** Unified money format used across every screen: two decimals, currency after the number. */
export function formatMoney(amount: number | string, currency: string): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${value.toFixed(2)} ${currency}`;
}

/** Same as formatMoney, with an explicit +/- sign so income/expense are never ambiguous. */
export function formatSignedAmount(
  type: "expense" | "income",
  amount: number | string,
  currency: string,
): string {
  const sign = type === "expense" ? "-" : "+";
  return `${sign}${formatMoney(amount, currency)}`;
}

/** "2026-03-05 14:30" — the one date/time format used across screens and exports. */
export function formatDateShort(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

const RU_MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const RU_MONTHS_NOMINATIVE = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const DAY_MS = 24 * 60 * 60 * 1000;

function isNextCalendarMonth(from: Date, to: Date): boolean {
  const sameYearNextMonth = to.getFullYear() === from.getFullYear() && to.getMonth() === from.getMonth() + 1;
  const yearRollover =
    from.getMonth() === 11 && to.getMonth() === 0 && to.getFullYear() === from.getFullYear() + 1;
  return sameYearNextMonth || yearRollover;
}

function formatShortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

/**
 * A human label for a [from, to) range: a single day, a whole calendar month,
 * or a generic inclusive date range — so every report says what period it covers.
 */
export function formatPeriodLabel(from: Date, to: Date): string {
  if (to.getTime() - from.getTime() === DAY_MS) {
    return `${from.getDate()} ${RU_MONTHS_GENITIVE[from.getMonth()]} ${from.getFullYear()}`;
  }
  const isFullMonth = from.getDate() === 1 && to.getDate() === 1 && isNextCalendarMonth(from, to);
  if (isFullMonth) {
    return `${RU_MONTHS_NOMINATIVE[from.getMonth()]} ${from.getFullYear()}`;
  }
  const inclusiveTo = new Date(to.getTime() - DAY_MS);
  return `${formatShortDate(from)} – ${formatShortDate(inclusiveTo)}`;
}

/** Title + lines, or a helpful empty-state instead of a bare "no data". */
export function renderScreen(params: { title: string; lines: string[]; emptyText?: string }): string {
  const { title, lines, emptyText } = params;
  const body = lines.length > 0 ? lines.join("\n") : (emptyText ?? "Пока нет данных.");
  return `<b>${escapeHtml(title)}</b>\n${body}`;
}

export interface BalanceOverviewLike {
  totalGel: number;
  unconvertedByCurrency: { currency: string; amount: number }[];
}

/**
 * The balance shown after saving a transaction. Never invents a number: when some of the
 * user's transactions couldn't be converted to GEL, the GEL total is labelled as excluding
 * them, and their raw per-currency sums are listed separately instead of being folded in.
 */
export function formatBalanceOverview(overview: BalanceOverviewLike): string {
  const hasUnconverted = overview.unconvertedByCurrency.length > 0;
  const lines = [
    hasUnconverted
      ? `Остаток (без валют без курса): ${formatMoney(overview.totalGel, "GEL")}`
      : `Остаток: ${formatMoney(overview.totalGel, "GEL")}`,
  ];
  for (const entry of overview.unconvertedByCurrency) {
    lines.push(`⚠️ Также есть операции без курса: ${formatMoney(entry.amount, entry.currency)}`);
  }
  return lines.join("\n");
}

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
}

/** Clamps `page` into range and slices `items` into a page of `pageSize` — for long lists. */
export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = clampedPage * pageSize;
  return { items: items.slice(start, start + pageSize), page: clampedPage, totalPages };
}
