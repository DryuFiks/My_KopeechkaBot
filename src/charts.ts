// Text/emoji "charts" for Telegram (MKB-010) — no image rendering, no external services.
// Pure functions: every number they need is passed in, nothing here touches the database.

import { formatMoney } from "./format";

const BAR_BLOCKS = { filled: "█", empty: "░" };

/** A horizontal plan/fact bar for one category. Handles a zero plan without dividing by it. */
export function renderBarRow(label: string, planGel: number, factGel: number, width = 12): string {
  const ratio = planGel > 0 ? Math.min(1, factGel / planGel) : factGel > 0 ? 1 : 0;
  const filled = Math.round(ratio * width);
  const bar = BAR_BLOCKS.filled.repeat(filled) + BAR_BLOCKS.empty.repeat(width - filled);
  const percentText = planGel > 0 ? `${Math.round((factGel / planGel) * 100)}%` : "план 0";
  return `${label}\n${bar} ${percentText} (${formatMoney(factGel, "GEL")} / ${formatMoney(planGel, "GEL")})`;
}

export interface ShareItem {
  category: string | null;
  amountGel: number;
}

export interface ShareRow {
  category: string | null;
  label: string;
  amountGel: number;
  percent: number;
  bar: string;
  /** false for the synthetic "Прочее" bucket — it has no single category to drill into. */
  drillable: boolean;
}

/**
 * Largest-remainder rounding: percentages sum to exactly 100 (when total > 0) instead of
 * drifting from independently-rounded values (e.g. three 33.3% shares rounding to 99%).
 */
function distributePercents(amounts: number[], total: number): number[] {
  if (total <= 0) return amounts.map(() => 0);
  const raw = amounts.map((amount) => (amount / total) * 100);
  const floors = raw.map(Math.floor);
  const remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < remainder; k++) {
    result[order[k % order.length].index] += 1;
  }
  return result;
}

/**
 * Ranks categories by amount (descending), keeps the top `topN`, and folds the rest into
 * a single "Прочее" row — the text/emoji stand-in for a ring chart's limited slice count.
 */
export function renderShareList(items: ShareItem[], topN = 6, barWidth = 10): ShareRow[] {
  const sorted = [...items].sort((a, b) => b.amountGel - a.amountGel);
  const total = sorted.reduce((sum, item) => sum + item.amountGel, 0);
  const head = sorted.slice(0, topN);
  const tail = sorted.slice(topN);

  const buckets: { category: string | null; label: string; amountGel: number; drillable: boolean }[] =
    head.map((item) => ({
      category: item.category,
      label: item.category ?? "Без категории",
      amountGel: item.amountGel,
      drillable: true,
    }));
  if (tail.length > 0) {
    buckets.push({
      category: null,
      label: "Прочее",
      amountGel: tail.reduce((sum, item) => sum + item.amountGel, 0),
      drillable: false,
    });
  }

  const percents = distributePercents(
    buckets.map((b) => b.amountGel),
    total,
  );
  return buckets.map((bucket, index) => {
    const percent = percents[index];
    const filled = Math.round((percent / 100) * barWidth);
    return {
      category: bucket.category,
      label: bucket.label,
      amountGel: bucket.amountGel,
      percent,
      bar: BAR_BLOCKS.filled.repeat(filled) + BAR_BLOCKS.empty.repeat(barWidth - filled),
      drillable: bucket.drillable,
    };
  });
}

export function formatShareRow(row: ShareRow): string {
  return `${row.bar} ${row.percent}% ${row.label} — ${formatMoney(row.amountGel, "GEL")}`;
}

export interface TrendPoint {
  label: string;
  valueGel: number;
}

const SPARKLINE_BLOCKS = "▁▂▃▄▅▆▇█";

/** A one-line sparkline for a day/month series, plus the first→last values for scale. */
export function renderTrendLine(points: TrendPoint[]): string {
  if (points.length === 0) return "Нет данных за период.";
  const values = points.map((p) => p.valueGel);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const sparkline = values
    .map((value) => SPARKLINE_BLOCKS[Math.round(((value - min) / range) * (SPARKLINE_BLOCKS.length - 1))])
    .join("");
  const first = points[0];
  const last = points[points.length - 1];
  return `${sparkline}\n${first.label} → ${last.label}: ${formatMoney(first.valueGel, "GEL")} → ${formatMoney(last.valueGel, "GEL")}`;
}
