// Admin alerts and morning summary (MKB-045): every ERROR log line reaches ADMIN_TELEGRAM_ID
// (at most one per error type per 10 minutes), and at 9:00 the admin's time a daily summary arrives.
// Rules and texts live in adminAlertRules.ts; this module only wires them to the bot and the DB.

import { Bot } from "grammy";
import { checkConnection } from "./db";
import { getActivityStats } from "./db/admin";
import { getUserSettings } from "./db/settings";
import { getAllRateInfo } from "./currency";
import { getUptimeMs } from "./metrics";
import { logger, setErrorListener } from "./logger";
import { zonedHour, zonedTodayIso } from "./timezone";
import {
  AlertThrottle,
  ErrorTally,
  alertKey,
  formatAdminSummary,
  formatErrorAlert,
  isSummaryDue,
} from "./adminAlertRules";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function getAdminId(): number | null {
  const id = Number(process.env.ADMIN_TELEGRAM_ID);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function sendSummary(bot: Bot, adminId: number, tally: ErrorTally): Promise<void> {
  let dbOk = true;
  try {
    await checkConnection();
  } catch {
    dbOk = false;
  }
  const rateLines = getAllRateInfo().map(
    (r) => `${r.currency} ${r.rateToGel === null ? "нет" : r.isFallback ? "устаревший" : "свежий"}`,
  );
  const text = formatAdminSummary({
    uptimeMs: getUptimeMs(),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    dbOk,
    rateLines,
    errors: tally.drain(),
    activity: dbOk ? await getActivityStats() : null,
  });
  await bot.api.sendMessage(adminId, text, { parse_mode: "HTML" });
}

export function startAdminAlerts(bot: Bot): void {
  const adminId = getAdminId();
  if (adminId === null) {
    logger.warn("ADMIN_TELEGRAM_ID is not set — admin alerts and summary are off.");
    return;
  }

  const throttle = new AlertThrottle();
  const tally = new ErrorTally();
  setErrorListener((message) => {
    const key = alertKey(message);
    tally.add(key);
    const skipped = throttle.take(key, Date.now());
    if (skipped === null) return;
    // WARN, not ERROR, on failure — an ERROR here would trigger another alert.
    bot.api
      .sendMessage(adminId, formatErrorAlert(message, skipped), { parse_mode: "HTML" })
      .catch((err) => logger.warn(`Could not send admin alert: ${(err as Error).message}`));
  });

  let lastSummaryIso: string | null = null;
  const tick = async () => {
    const { timezone } = await getUserSettings(adminId);
    const todayIso = zonedTodayIso(timezone);
    if (!isSummaryDue(zonedHour(timezone), todayIso, lastSummaryIso)) return;
    lastSummaryIso = todayIso;
    await sendSummary(bot, adminId, tally);
  };
  const run = () => tick().catch((err) => logger.warn(`admin summary: ${(err as Error).message}`));
  run();
  setInterval(run, CHECK_INTERVAL_MS);
}
