// Payment-due reminders (MKB-012). A reminder is never the same thing as a transaction —
// this module only ever *sends a message*; the actual expense is inserted only when the
// user explicitly taps "Записать" (see features/payments.ts's payrem:*:record handler).

import { Bot } from "grammy";
import { getRemindablePayments, markPaymentNotified, RemindablePayment } from "./db/payments";
import { paymentReminderKeyboard } from "./keyboards";
import { isPaymentDueToday } from "./paymentDueCheck";
import { zonedToday } from "./timezone";
import { escapeHtml, formatMoney } from "./format";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly is plenty for a day-granularity due date

function isoFromParts(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

async function notifyDuePayment(bot: Bot, payment: RemindablePayment): Promise<void> {
  const text = `🔔 Сегодня платёж «${escapeHtml(payment.title)}»: ${formatMoney(payment.amount, payment.currency)} (день ${payment.due_day}).\nЗаписать как расход?`;
  await bot.api.sendMessage(Number(payment.user_id), text, {
    parse_mode: "HTML",
    reply_markup: paymentReminderKeyboard(payment.id),
  });
  // Marked only after a successful send — if sendMessage throws (e.g. user blocked the
  // bot), the next hourly check retries instead of silently giving up for the day.
  await markPaymentNotified(payment.id);
}

async function checkDuePayments(bot: Bot): Promise<void> {
  const payments = await getRemindablePayments();
  for (const payment of payments) {
    if (!payment.notify_payments) continue;
    const todayIso = isoFromParts(zonedToday(payment.timezone));
    const lastNotifiedIso = payment.last_notified ? payment.last_notified.toISOString().slice(0, 10) : null;
    if (!isPaymentDueToday(payment.due_day, todayIso, lastNotifiedIso)) continue;
    try {
      await notifyDuePayment(bot, payment);
    } catch (err) {
      logger.warn(`Could not send payment reminder #${payment.id}: ${(err as Error).message}`);
    }
  }
}

/** Runs once at startup, then hourly for the lifetime of the process. */
export function startPaymentReminders(bot: Bot): void {
  const run = () => {
    checkDuePayments(bot).catch((err) => logger.error(`payment reminders: ${(err as Error).message}`));
  };
  run();
  setInterval(run, CHECK_INTERVAL_MS);
}
