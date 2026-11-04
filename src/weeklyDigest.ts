// Pure part of the weekly digest (MKB-058): when to send and what it says. No DB, no bot.
// The scheduler and data gathering live in userReminders.ts.

import { escapeHtml, formatMoney, renderScreen } from "./format";
import { INACTIVE_AFTER_DAYS } from "./eveningReminder";

export const DIGEST_WEEKDAY = 7; // Sunday (1 = Monday)
export const DIGEST_HOUR = 19;
const NEAR_LIMIT = 0.9;
const DAY_MS = 86_400_000;

export function isDigestDue(p: {
  enabled: boolean;
  weekday: number;
  localHour: number;
  todayIso: string;
  lastSentIso: string | null;
  lastActiveAt: Date | null;
  now: Date;
}): boolean {
  if (!p.enabled || p.weekday !== DIGEST_WEEKDAY || p.localHour < DIGEST_HOUR) return false;
  if (p.lastSentIso === p.todayIso) return false;
  return !!p.lastActiveAt && p.now.getTime() - p.lastActiveAt.getTime() <= INACTIVE_AFTER_DAYS * DAY_MS;
}

export interface DigestData {
  weekGel: number;
  prevWeekGel: number;
  /** Week's expenses by category, largest first. */
  topCategories: { category: string | null; amountGel: number }[];
  /** This month's categories with a limit. */
  limits: { category: string; spentGel: number; limitGel: number }[];
  /** The active goal closest to done, if any. */
  goal: { title: string; savedGel: number; targetGel: number } | null;
}

/** Categories at 90% of the month's limit or more, the fullest first. */
export function nearLimits(limits: DigestData["limits"]): DigestData["limits"] {
  return limits
    .filter((l) => l.limitGel > 0 && l.spentGel >= l.limitGel * NEAR_LIMIT)
    .sort((a, b) => b.spentGel / b.limitGel - a.spentGel / a.limitGel);
}

/** One practical line, chosen from the data — never a generic lecture. */
export function digestTip(d: DigestData): string {
  const over = nearLimits(d.limits).find((l) => l.spentGel > l.limitGel);
  if (over) return `«${over.category}» уже выше лимита месяца — до конца месяца можно держать её на паузе.`;
  if (d.prevWeekGel > 0 && d.weekGel > d.prevWeekGel * 1.2)
    return "Траты выросли больше чем на 20% — загляните, какая категория дала рост.";
  if (d.goal && d.goal.savedGel < d.goal.targetGel) {
    const left = d.goal.targetGel - d.goal.savedGel;
    return `До цели «${d.goal.title}» осталось ${formatMoney(left, "GEL")} — даже небольшой взнос на этой неделе приблизит её.`;
  }
  return "Неделя ровная — так держать.";
}

function change(week: number, prev: number): string {
  if (prev <= 0) return "";
  const pct = Math.round(((week - prev) / prev) * 100);
  if (pct === 0) return " (как на прошлой неделе)";
  return pct > 0 ? ` (на ${pct}% больше прошлой)` : ` (на ${-pct}% меньше прошлой)`;
}

export function formatWeeklyDigest(d: DigestData): string {
  const lines = [
    `Траты за неделю: <b>${formatMoney(d.weekGel, "GEL")}</b>${change(d.weekGel, d.prevWeekGel)}`,
  ];
  const top = d.topCategories.filter((c) => c.amountGel > 0).slice(0, 3);
  if (top.length > 0) {
    lines.push("", "Больше всего:");
    for (const c of top)
      lines.push(`• ${escapeHtml(c.category ?? "Без категории")} — ${formatMoney(c.amountGel, "GEL")}`);
  }
  const near = nearLimits(d.limits).slice(0, 3);
  if (near.length > 0) {
    lines.push("", "У лимита месяца:");
    for (const l of near)
      lines.push(
        `• ${escapeHtml(l.category)} — ${formatMoney(l.spentGel, "GEL")} из ${formatMoney(l.limitGel, "GEL")}`,
      );
  }
  if (d.goal) {
    const pct = Math.min(100, Math.round((d.goal.savedGel / d.goal.targetGel) * 100));
    lines.push("", `Цель «${escapeHtml(d.goal.title)}»: ${pct}%`);
  }
  lines.push("", `💡 ${escapeHtml(digestTip(d))}`);
  return renderScreen({ title: "📊 Итоги недели", lines });
}
