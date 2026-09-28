import { Bot, InlineKeyboard } from "grammy";
import { getUserSettings, resetUserSettings, updateUserSettings, UserSettings } from "../db/settings";
import { mainKeyboard } from "../keyboards";
import { editOrReply } from "../editOrReply";
import { renderScreen, PARSE_MODE } from "../format";
import { isValidTimeZone } from "../timezone";
import { SUPPORTED_CURRENCIES, SupportedCurrency } from "../currencies";
import { safe, safeCallback } from "../middleware/safe";

function settingsKeyboard(current: SupportedCurrency): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const currency of SUPPORTED_CURRENCIES) {
    keyboard.text(currency === current ? `• ${currency}` : currency, `settings:currency:${currency}`);
  }
  return keyboard
    .row()
    .text("🔔 Напоминания о платежах: переключить", "settings:notify:toggle")
    .row()
    .text("↩️ Сбросить настройки", "settings:reset")
    .row()
    .text("⬅️ Главное меню", "menu:main");
}

function settingsText(settings: UserSettings): string {
  return renderScreen({
    title: "Настройки",
    lines: [
      `Валюта отображения: ${settings.displayCurrency}`,
      `Часовой пояс: ${settings.timezone}`,
      `Напоминания о платежах: ${settings.notifyPayments ? "включены" : "выключены"}`,
      "",
      "Команды:",
      "/settings currency GEL|RUB|USD",
      "/settings timezone &lt;IANA-зона&gt;, например Europe/Moscow",
      "/settings notify on|off",
      "/settings reset — вернуть настройки по умолчанию",
    ],
  });
}

export function registerSettingsHandlers(bot: Bot): void {
  bot.command(
    "settings",
    safe("settings", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const text = ctx.message?.text ?? "";

      const currencyMatch = /^\/settings\s+currency\s+(GEL|RUB|USD)\s*$/i.exec(text);
      if (currencyMatch) {
        const displayCurrency = currencyMatch[1].toUpperCase() as SupportedCurrency;
        const settings = await updateUserSettings(uid, { displayCurrency });
        await ctx.reply(settingsText(settings), {
          parse_mode: PARSE_MODE,
          reply_markup: settingsKeyboard(settings.displayCurrency),
        });
        return;
      }

      const timezoneMatch = /^\/settings\s+timezone\s+(\S+)\s*$/i.exec(text);
      if (timezoneMatch) {
        const timezone = timezoneMatch[1];
        if (!isValidTimeZone(timezone)) {
          await ctx.reply(
            `Неизвестный часовой пояс «${timezone}». Используй IANA-название, например Europe/Moscow, Asia/Tbilisi, UTC.`,
            { reply_markup: mainKeyboard },
          );
          return;
        }
        const settings = await updateUserSettings(uid, { timezone });
        await ctx.reply(settingsText(settings), {
          parse_mode: PARSE_MODE,
          reply_markup: settingsKeyboard(settings.displayCurrency),
        });
        return;
      }

      const notifyMatch = /^\/settings\s+notify\s+(on|off)\s*$/i.exec(text);
      if (notifyMatch) {
        const settings = await updateUserSettings(uid, {
          notifyPayments: notifyMatch[1].toLowerCase() === "on",
        });
        await ctx.reply(settingsText(settings), {
          parse_mode: PARSE_MODE,
          reply_markup: settingsKeyboard(settings.displayCurrency),
        });
        return;
      }

      if (/^\/settings\s+reset\s*$/i.test(text)) {
        await resetUserSettings(uid);
        const settings = await getUserSettings(uid);
        await ctx.reply(`Настройки сброшены на значения по умолчанию.\n\n${settingsText(settings)}`, {
          parse_mode: PARSE_MODE,
          reply_markup: settingsKeyboard(settings.displayCurrency),
        });
        return;
      }

      const settings = await getUserSettings(uid);
      await ctx.reply(settingsText(settings), {
        parse_mode: PARSE_MODE,
        reply_markup: settingsKeyboard(settings.displayCurrency),
      });
    }),
  );

  bot.callbackQuery(
    "action:settings",
    safeCallback("action:settings", async (ctx) => {
      const settings = await getUserSettings(ctx.from.id);
      await editOrReply(ctx, settingsText(settings), {
        reply_markup: settingsKeyboard(settings.displayCurrency),
        parse_mode: PARSE_MODE,
      });
    }),
  );

  bot.callbackQuery(
    /^settings:currency:(GEL|RUB|USD)$/,
    safeCallback("settings:currency", async (ctx) => {
      const settings = await updateUserSettings(ctx.from.id, {
        displayCurrency: ctx.match[1] as SupportedCurrency,
      });
      await editOrReply(ctx, settingsText(settings), {
        reply_markup: settingsKeyboard(settings.displayCurrency),
        parse_mode: PARSE_MODE,
      });
    }),
  );

  bot.callbackQuery(
    "settings:notify:toggle",
    safeCallback("settings:notify", async (ctx) => {
      const current = await getUserSettings(ctx.from.id);
      const settings = await updateUserSettings(ctx.from.id, { notifyPayments: !current.notifyPayments });
      await editOrReply(ctx, settingsText(settings), {
        reply_markup: settingsKeyboard(settings.displayCurrency),
        parse_mode: PARSE_MODE,
      });
    }),
  );

  bot.callbackQuery(
    "settings:reset",
    safeCallback("settings:reset", async (ctx) => {
      await resetUserSettings(ctx.from.id);
      const settings = await getUserSettings(ctx.from.id);
      await editOrReply(ctx, settingsText(settings), {
        reply_markup: settingsKeyboard(settings.displayCurrency),
        parse_mode: PARSE_MODE,
      });
    }),
  );
}
