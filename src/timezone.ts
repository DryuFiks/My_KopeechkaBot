// Per-user timezone math for day/month boundaries (MKB-013). Pure functions built on
// Intl — no new dependency, no DB/network — so every day/month boundary in the app can
// be computed "as the user sees midnight", not as the bot server's local clock sees it.

interface ZonedParts {
  year: number;
  month: number; // 1-indexed, matching Date's human convention (not JS Date's 0-indexed)
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    // The constructor validates the IANA identifier eagerly and throws RangeError
    // for anything it doesn't recognize — no need to actually format anything.
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23", // avoids the "24:00 instead of 00:00" gotcha of hour12:false
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of formatted) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/**
 * The UTC instant equal to `year-month-day 00:00:00` as observed in `timeZone`.
 * One-step correction: convert a UTC-domain guess to the zone, read back what wall
 * clock it shows, and shift by the difference — exact for every real IANA zone except
 * the vanishingly rare case where a DST transition lands exactly at local midnight,
 * which the offset approximation only misses by the transition's own size (usually 1h).
 *
 * `month`/`day` may be out of their normal 1-12 / 1-31 range (e.g. month 0 or 13) —
 * same overflow-normalizes-into-the-next/previous-unit behavior as `Date.UTC`, which
 * this is built on. Callers (e.g. period.ts) rely on that to roll a Y-M-D triple across
 * a month/year boundary just by adding/subtracting, without separate carry logic.
 */
export function zonedDateBoundary(year: number, month: number, day: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const shown = getZonedParts(guess, timeZone);
  const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
  const offsetMs = shownAsUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * [from, to) boundaries of the calendar day containing `date`, as seen in `timeZone`.
 * `to` is computed as its own boundary (day + 1), never by adding 24h to `from` — that
 * would be wrong across a DST transition, where a local day isn't exactly 24h long.
 */
export function zonedDayBoundaries(date: Date, timeZone: string): DateRange {
  const parts = getZonedParts(date, timeZone);
  const from = zonedDateBoundary(parts.year, parts.month, parts.day, timeZone);
  const to = zonedDateBoundary(parts.year, parts.month, parts.day + 1, timeZone);
  return { from, to };
}

/** [from, to) boundaries of the calendar month containing `date`, as seen in `timeZone`. */
export function zonedMonthBoundaries(date: Date, timeZone: string): DateRange {
  const parts = getZonedParts(date, timeZone);
  const from = zonedDateBoundary(parts.year, parts.month, 1, timeZone);
  const to = zonedDateBoundary(parts.year, parts.month + 1, 1, timeZone);
  return { from, to };
}

/** Today's calendar date as seen in `timeZone` — e.g. to compare against a due-day. */
export function zonedToday(
  timeZone: string,
  date = new Date(),
): { year: number; month: number; day: number } {
  const { year, month, day } = getZonedParts(date, timeZone);
  return { year, month, day };
}
