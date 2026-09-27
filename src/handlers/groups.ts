import { Bot } from "grammy";
import {
  mainKeyboard,
  financeKeyboard,
  analyticsKeyboard,
  planningKeyboard,
  serviceKeyboard,
} from "../keyboards";

export function registerGroupMenuHandlers(bot: Bot): void {
  bot.hears("⬅️ Главное меню", async (ctx) => {
    await ctx.reply("Главное меню", { reply_markup: mainKeyboard });
  });

  bot.hears("💰 Финансы", async (ctx) => {
    await ctx.reply("💰 Финансы", { reply_markup: financeKeyboard });
  });

  bot.hears("📊 Аналитика", async (ctx) => {
    await ctx.reply("📊 Аналитика", { reply_markup: analyticsKeyboard });
  });

  bot.hears("🗓 Планирование", async (ctx) => {
    await ctx.reply("🗓 Планирование", { reply_markup: planningKeyboard });
  });

  bot.hears("🛠 Сервис", async (ctx) => {
    await ctx.reply("🛠 Сервис", { reply_markup: serviceKeyboard });
  });
}
