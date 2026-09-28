import { Bot } from "grammy";
import {
  mainKeyboard,
  financeKeyboard,
  analyticsKeyboard,
  planningKeyboard,
  serviceKeyboard,
} from "../keyboards";
import { editOrReply } from "../editOrReply";
import { safeCallback } from "../middleware/safe";

const MENU = {
  main: { text: "Главное меню", keyboard: mainKeyboard },
  finance: { text: "💰 Финансы", keyboard: financeKeyboard },
  analytics: { text: "📊 Аналитика", keyboard: analyticsKeyboard },
  planning: { text: "🗓 Планирование", keyboard: planningKeyboard },
  service: { text: "🛠 Сервис", keyboard: serviceKeyboard },
} as const;

export function registerNavigationHandlers(bot: Bot): void {
  // The page-indicator button in paginationKeyboard — nothing to do, just ack the tap.
  bot.callbackQuery(
    "noop",
    safeCallback("noop", async () => {}),
  );

  bot.callbackQuery(
    /^menu:(main|finance|analytics|planning|service)$/,
    safeCallback("navigation", async (ctx) => {
      const section = ctx.match[1] as keyof typeof MENU;
      const menu = MENU[section];
      await editOrReply(ctx, menu.text, { reply_markup: menu.keyboard });
    }),
  );
}
