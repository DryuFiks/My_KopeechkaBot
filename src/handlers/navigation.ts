import { Bot } from "grammy";
import {
  mainKeyboard,
  financeKeyboard,
  analyticsKeyboard,
  planningKeyboard,
  serviceKeyboard,
} from "../keyboards";
import { logger } from "../logger";
import { safeCallback } from "../middleware/safe";

const MENU = {
  main: { text: "Главное меню", keyboard: mainKeyboard },
  finance: { text: "💰 Финансы", keyboard: financeKeyboard },
  analytics: { text: "📊 Аналитика", keyboard: analyticsKeyboard },
  planning: { text: "🗓 Планирование", keyboard: planningKeyboard },
  service: { text: "🛠 Сервис", keyboard: serviceKeyboard },
} as const;

export function registerNavigationHandlers(bot: Bot): void {
  bot.callbackQuery(
    /^menu:(main|finance|analytics|planning|service)$/,
    safeCallback("navigation", async (ctx) => {
      const section = ctx.match[1] as keyof typeof MENU;
      const menu = MENU[section];
      try {
        await ctx.editMessageText(menu.text, { reply_markup: menu.keyboard });
      } catch (err) {
        // Telegram refuses the edit (message too old/deleted, or from a group where
        // the bot lost the message) — fall back to a fresh message instead of a silent no-op.
        logger.warn(`navigation: editMessageText failed, falling back to reply: ${(err as Error).message}`);
        await ctx.reply(menu.text, { reply_markup: menu.keyboard });
      }
    }),
  );
}
