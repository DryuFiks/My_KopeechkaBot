import { Bot } from "grammy";
import {
  mainKeyboard,
  financeKeyboard,
  analyticsKeyboard,
  planningKeyboard,
  serviceKeyboard,
} from "../keyboards";

const MENU = {
  main: { text: "Главное меню", keyboard: mainKeyboard },
  finance: { text: "💰 Финансы", keyboard: financeKeyboard },
  analytics: { text: "📊 Аналитика", keyboard: analyticsKeyboard },
  planning: { text: "🗓 Планирование", keyboard: planningKeyboard },
  service: { text: "🛠 Сервис", keyboard: serviceKeyboard },
} as const;

export function registerGroupMenuHandlers(bot: Bot): void {
  bot.callbackQuery(/^menu:(main|finance|analytics|planning|service)$/, async (ctx) => {
    const section = ctx.match[1] as keyof typeof MENU;
    const menu = MENU[section];
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(menu.text, { reply_markup: menu.keyboard }).catch(() => {
      // Navigation must not create extra chat messages if Telegram refuses the edit.
    });
  });
}
