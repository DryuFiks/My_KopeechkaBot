import { Bot, InlineKeyboard } from "grammy";
import { trackEvent } from "../db/events";
import { updateUserSettings } from "../db/settings";
import { safeCallback } from "../middleware/safe";

/** MKB-057: buttons under the evening reminder. Both are safe to tap twice. */
export function registerReminderHandlers(bot: Bot): void {
  bot.callbackQuery(
    "evening:nospend",
    safeCallback("evening:nospend", async (ctx) => {
      trackEvent(ctx.from.id, "no_spend_day", "bot");
      await ctx.answerCallbackQuery({ text: "Отмечено" });
      await ctx
        .editMessageText("👍 Отмечено: сегодня без трат.", { reply_markup: new InlineKeyboard() })
        .catch(() => {});
    }),
  );

  bot.callbackQuery(
    "evening:off",
    safeCallback("evening:off", async (ctx) => {
      await updateUserSettings(ctx.from.id, { remindEvening: false });
      await ctx.answerCallbackQuery({ text: "Напоминания выключены" });
      await ctx
        .editMessageText(
          "🔕 Вечерние напоминания выключены. Включить снова — /settings или в мини-приложении.",
          {
            reply_markup: new InlineKeyboard(),
          },
        )
        .catch(() => {});
    }),
  );
}
