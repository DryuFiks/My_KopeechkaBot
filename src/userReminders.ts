// Personal reminders the user turned on (MKB-057). Off by default; each one is switched off with one tap
// right in the message or in the settings. Rules live in eveningReminder.ts; this module only schedules.

import { Bot, InlineKeyboard } from "grammy";
import { getEveningCandidates, markEveningNotified } from "./db/reminders";
import { isEveningReminderDue } from "./eveningReminder";
import { zonedDayBoundaries, zonedHour, zonedTodayIso } from "./timezone";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const EVENING_TEXT = "🌙 Сегодня ничего не записано. Были траты?";

export function eveningKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  const url = process.env.WEBAPP_URL;
  if (url && url.startsWith("https://")) kb.webApp("📱 Записать в Копеечке", url).row();
  return kb.text("✅ Трат не было", "evening:nospend").row().text("🔕 Не напоминать", "evening:off");
}

async function checkEvening(bot: Bot): Promise<void> {
  const now = new Date();
  for (const c of await getEveningCandidates()) {
    const todayIso = zonedTodayIso(c.timezone, now);
    const due = isEveningReminderDue({
      enabled: true,
      remindHour: c.remindHour,
      localHour: zonedHour(c.timezone, now),
      todayIso,
      lastNotifiedIso: c.lastNotified,
      dayStart: zonedDayBoundaries(now, c.timezone).from,
      lastRecordAt: c.lastRecordAt,
      lastActiveAt: c.lastActiveAt,
      now,
    });
    if (!due) continue;
    try {
      await bot.api.sendMessage(c.userId, EVENING_TEXT, { reply_markup: eveningKeyboard() });
      // Marked only after a successful send: a failed send is retried on the next check.
      await markEveningNotified(c.userId, todayIso);
    } catch (err) {
      logger.warn(`Evening reminder for ${c.userId} not sent: ${(err as Error).message}`);
    }
  }
}

export function startUserReminders(bot: Bot): void {
  const run = () => {
    checkEvening(bot).catch((err) => logger.error(`user reminders: ${(err as Error).message}`));
  };
  run();
  setInterval(run, CHECK_INTERVAL_MS);
}
