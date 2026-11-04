// Personal reminders the user turned on: the evening reminder (MKB-057) and the weekly digest (MKB-058).
// Off by default; each is switched off with one tap right in the message or in the settings.
// Rules live in eveningReminder.ts / weeklyDigest.ts; this module only schedules and gathers data.

import { Bot, InlineKeyboard } from "grammy";
import { getExpenseCategoryTotals, getSummaryForRange } from "./db";
import { getBudgetReport } from "./db/budget";
import { listGoals } from "./db/goals";
import {
  getDigestCandidates,
  getEveningCandidates,
  markDigestSent,
  markEveningNotified,
} from "./db/reminders";
import { isEveningReminderDue } from "./eveningReminder";
import { formatWeeklyDigest, isDigestDue, type DigestData } from "./weeklyDigest";
import {
  zonedDateBoundary,
  zonedDayBoundaries,
  zonedHour,
  zonedMonthBoundaries,
  zonedToday,
  zonedTodayIso,
  zonedWeekday,
} from "./timezone";
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

/** MKB-058: last 7 local days vs the 7 before, top categories, this month's limits, the closest goal. */
async function collectDigest(userId: number, timeZone: string, now: Date): Promise<DigestData> {
  const { year, month, day } = zonedToday(timeZone, now);
  const weekFrom = zonedDateBoundary(year, month, day - 6, timeZone);
  const weekTo = zonedDateBoundary(year, month, day + 1, timeZone);
  const prevFrom = zonedDateBoundary(year, month, day - 13, timeZone);
  const monthRange = zonedMonthBoundaries(now, timeZone);
  const [week, prev, top, budget, goals] = await Promise.all([
    getSummaryForRange(userId, weekFrom, weekTo),
    getSummaryForRange(userId, prevFrom, weekFrom),
    getExpenseCategoryTotals(userId, weekFrom, weekTo),
    getBudgetReport(userId, monthRange.from, monthRange.to),
    listGoals(userId),
  ]);
  const goal = goals
    .map((g) => ({ title: g.title, savedGel: Number(g.saved_gel), targetGel: Number(g.target_gel) }))
    .filter((g) => g.targetGel > 0 && g.savedGel < g.targetGel)
    .sort((a, b) => b.savedGel / b.targetGel - a.savedGel / a.targetGel)[0];
  return {
    weekGel: week.expense_gel,
    prevWeekGel: prev.expense_gel,
    topCategories: top,
    limits: budget
      .filter((b) => b.category !== null && b.effectiveLimitGel !== null)
      .map((b) => ({
        category: b.category as string,
        spentGel: b.spentGel,
        limitGel: b.effectiveLimitGel as number,
      })),
    goal: goal ?? null,
  };
}

async function checkDigest(bot: Bot): Promise<void> {
  const now = new Date();
  for (const c of await getDigestCandidates()) {
    const todayIso = zonedTodayIso(c.timezone, now);
    const due = isDigestDue({
      enabled: true,
      weekday: zonedWeekday(c.timezone, now),
      localHour: zonedHour(c.timezone, now),
      todayIso,
      lastSentIso: c.lastSent,
      lastActiveAt: c.lastActiveAt,
      now,
    });
    if (!due) continue;
    try {
      const text = formatWeeklyDigest(await collectDigest(c.userId, c.timezone, now));
      await bot.api.sendMessage(c.userId, text, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().text("🔕 Не присылать итоги недели", "digest:off"),
      });
      await markDigestSent(c.userId, todayIso);
    } catch (err) {
      logger.warn(`Weekly digest for ${c.userId} not sent: ${(err as Error).message}`);
    }
  }
}

export function startUserReminders(bot: Bot): void {
  const run = () => {
    checkEvening(bot).catch((err) => logger.error(`user reminders: ${(err as Error).message}`));
    checkDigest(bot).catch((err) => logger.error(`weekly digest: ${(err as Error).message}`));
  };
  run();
  setInterval(run, CHECK_INTERVAL_MS);
}
