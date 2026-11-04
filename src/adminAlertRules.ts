// Pure part of admin alerts and the morning summary (MKB-045) — no DB, no bot, testable as is.
// The I/O shell is adminAlerts.ts.

import { escapeHtml, renderScreen } from "./format";

/** One alert per error type per window; repeats inside the window are only counted. */
export const ALERT_WINDOW_MS = 10 * 60 * 1000;
/** Admin's local hour for the morning summary. */
export const SUMMARY_HOUR = 9;
const MAX_ALERT_TEXT = 500;

/** Error "type": numbers (ids, amounts, times) are collapsed so the same failure with different values is one type. */
export function alertKey(message: string): string {
  return message.replace(/\d+/g, "#").slice(0, 80);
}

export class AlertThrottle {
  private readonly lastSent = new Map<string, number>();
  private readonly skipped = new Map<string, number>();

  constructor(private readonly windowMs = ALERT_WINDOW_MS) {}

  /** null — don't send now; otherwise how many alerts of this type were skipped since the last one sent. */
  take(key: string, now: number): number | null {
    const last = this.lastSent.get(key);
    if (last !== undefined && now - last < this.windowMs) {
      this.skipped.set(key, (this.skipped.get(key) ?? 0) + 1);
      return null;
    }
    const skipped = this.skipped.get(key) ?? 0;
    this.lastSent.set(key, now);
    this.skipped.delete(key);
    return skipped;
  }
}

/** Errors by type since the last summary. */
export class ErrorTally {
  private counts = new Map<string, number>();

  add(key: string): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  /** Total and the most frequent types, then starts counting from zero. */
  drain(top = 3): { total: number; top: { key: string; count: number }[] } {
    const entries = [...this.counts].map(([key, count]) => ({ key, count }));
    this.counts = new Map();
    return {
      total: entries.reduce((sum, e) => sum + e.count, 0),
      top: entries.sort((a, b) => b.count - a.count).slice(0, top),
    };
  }
}

export function formatErrorAlert(message: string, skipped: number): string {
  const text = message.length > MAX_ALERT_TEXT ? `${message.slice(0, MAX_ALERT_TEXT)}…` : message;
  const lines = [`<code>${escapeHtml(text)}</code>`];
  if (skipped > 0) lines.push(`Ещё ${skipped} таких же за 10 минут не отправлены.`);
  return renderScreen({ title: "⚠️ Ошибка в боте", lines });
}

/** Hourly checks land in the summary hour exactly once a day; lastSentIso stops a second send that day. */
export function isSummaryDue(localHour: number, todayIso: string, lastSentIso: string | null): boolean {
  return localHour === SUMMARY_HOUR && lastSentIso !== todayIso;
}

export function formatUptime(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}ч ${minutes}м`;
}

export interface AdminSummary {
  uptimeMs: number;
  memoryMb: number;
  dbOk: boolean;
  rateLines: string[];
  errors: { total: number; top: { key: string; count: number }[] };
  /** null when the DB is down. */
  activity: ActivityLike | null;
}

export interface ActivityLike {
  usersTotal: number;
  activeDay: number;
  activeWeek: number;
  transactionsDay: number;
  txWeekBot: number;
  txWeekWebapp: number;
}

/** Shared by the morning summary and /health. */
export function formatActivityLines(a: ActivityLike): string[] {
  return [
    `Активных за сутки: ${a.activeDay}, за неделю: ${a.activeWeek} (всего ${a.usersTotal})`,
    `Операций за сутки: ${a.transactionsDay}`,
    `Операций за неделю: в чате ${a.txWeekBot}, в мини-приложении ${a.txWeekWebapp}`,
  ];
}

export function formatAdminSummary(s: AdminSummary): string {
  const lines = [
    `Аптайм: ${formatUptime(s.uptimeMs)} · память ${s.memoryMb} МБ`,
    `БД: ${s.dbOk ? "OK" : "недоступна"}`,
    `Курсы: ${s.rateLines.join(", ")}`,
  ];
  if (s.activity) lines.push(...formatActivityLines(s.activity));
  lines.push(`Ошибок за сутки: ${s.errors.total}`);
  for (const e of s.errors.top) lines.push(`  ${e.count} × <code>${escapeHtml(e.key)}</code>`);
  return renderScreen({ title: "☀️ Сводка за сутки", lines });
}
