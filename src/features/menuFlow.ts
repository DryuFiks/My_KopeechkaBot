import { Bot } from "grammy";
import { pool } from "../db";
import { mainKeyboard, confirmKeyboard } from "../keyboards";
import { convertToGel, refreshRatesIfStale } from "../currency";
import { parseTransactionMessage, isParseError } from "../parser";
import { escapeHtml, PARSE_MODE } from "../format";
import { logger } from "../logger";
import { flows, money, safe, showBudget } from "./common";

export function registerMenuFlowHandlers(bot: Bot): void {
bot.command(
    "menu",
    safe("menu", async (ctx) => {
      flows.delete(ctx.from!.id);
      await ctx.reply("Главное меню", { reply_markup: mainKeyboard });
    }),
  );

bot.hears(
    "🔄 Перезапуск",
    safe("restart", async (ctx) => {
      const userId = ctx.from?.id;
      const adminId = Number(process.env.ADMIN_TELEGRAM_ID);

      if (!userId || !Number.isInteger(adminId) || adminId <= 0 || userId !== adminId) {
        await ctx.reply("Перезапуск доступен только администратору.", { reply_markup: mainKeyboard });
        return;
      }

      await ctx.reply("Перезапускаю бота. Подожди несколько секунд...");

      logger.info(`Restart requested by admin ${userId}`);

      // Завершаем обработчик и даём grammY
      // подтвердить полученное обновление Telegram.
      setTimeout(() => {
        process.exit(75);
      }, 3000);
    }),
  );

bot.on(
    "message:text",
    safe("menu/text", async (ctx) => {
      const uid = ctx.from?.id;
      const message = ctx.message;
      if (!uid || !message || !("text" in message) || typeof message.text !== "string") return;
      const text = message.text.trim();
      if (text.startsWith("/")) return;
      if (["💰 Финансы", "📊 Аналитика", "🗓 Планирование", "🛠 Сервис", "⬅️ Главное меню"].includes(text)) return;
      if (text === "🔄 Перезапуск") {
        return;
      }
      if (text === "❌ Отмена") {
        flows.delete(uid);
        await ctx.reply("Действие отменено.", { reply_markup: mainKeyboard });
        return;
      }
      if (text === "➖ Расход" || text === "➕ Доход") {
        const type = text.startsWith("➖") ? "expense" : "income";
        flows.set(uid, { type, stage: "amount" });
        await ctx.reply(
          `Введи сумму ${type === "expense" ? "расхода" : "дохода"}, например: 25 GEL Еда обед\nМожно и в старом формате: -25 gel еда обед`,
          { reply_markup: mainKeyboard },
        );
        return;
      }
      if (text === "📊 Бюджет") {
        await showBudget(ctx, uid);
        return;
      }
      if (text === "🧾 История") {
        const r = await pool.query(
          "SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 10",
          [uid],
        );
        await ctx.reply(
          r.rowCount
            ? r.rows
                .map(
                  (x: any) =>
                    `${x.type === "expense" ? "−" : "+"}${x.amount} ${x.currency} ${escapeHtml(x.category ?? "")} ${escapeHtml(x.note ?? "")}`,
                )
                .join("\n")
            : "Операций пока нет.",
          { parse_mode: PARSE_MODE, reply_markup: mainKeyboard },
        );
        return;
      }
      if (text === "🔁 Платежи") {
        const r = await pool.query(
          "SELECT id,title,amount,currency,due_day FROM recurring_payments WHERE user_id=$1 AND active ORDER BY due_day",
          [uid],
        );
        await ctx.reply(
          (r.rowCount
            ? r.rows
                .map((x: any) => `${x.id}. ${escapeHtml(x.title)} — ${x.amount} ${x.currency}, день ${x.due_day}`)
                .join("\n")
            : "Регулярных платежей нет.") + "\n\nДобавить: /payment день сумма валюта название",
          { parse_mode: PARSE_MODE, reply_markup: mainKeyboard },
        );
        return;
      }
      if (text === "🎯 Накопления") {
        const r = await pool.query(
          "SELECT id,title,saved_gel,target_gel FROM savings_goals WHERE user_id=$1 AND active ORDER BY id",
          [uid],
        );
        await ctx.reply(
          (r.rowCount
            ? r.rows
                .map((x: any) => `${x.id}. ${escapeHtml(x.title)} — ${money(x.saved_gel)} / ${money(x.target_gel)} GEL`)
                .join("\n")
            : "Целей пока нет.") + "\n\nСоздать: /goal Название сумма\nПополнить: /save ID сумма",
          { parse_mode: PARSE_MODE, reply_markup: mainKeyboard },
        );
        return;
      }
      if (text === "📈 Статистика") {
        await ctx.api.sendMessage(
          ctx.chat!.id,
          "Команда /stats покажет расходы по категориям. /export — выгрузка CSV.",
          { reply_markup: mainKeyboard },
        );
        return;
      }
      if (text === "⚙️ Настройки") {
        await ctx.reply(
          "Настройки: валюта по умолчанию GEL. Доступные валюты: GEL, RUB, USD.\nКоманды: /category, /budget, /payment, /goal, /export",
          { reply_markup: mainKeyboard },
        );
        return;
      }
      const flow = flows.get(uid);
      if (flow) {
        const parsed = parseTransactionMessage(text);
        if (isParseError(parsed)) {
          await ctx.reply(parsed.error);
          return;
        }
        if (parsed.type !== flow.type) {
          await ctx.reply(`Для этого шага нужен ${flow.type === "expense" ? "расход (минус)" : "доход (плюс)"}.`);
          return;
        }
        flow.amount = parsed.amount;
        flow.currency = parsed.currency;
        flow.category = parsed.category;
        flow.note = parsed.note;
        flow.stage = "confirm";
        await ctx.reply(
          `Проверь операцию:\n${flow.type === "expense" ? "Расход" : "Доход"}: ${flow.amount} ${flow.currency}\nКатегория: ${flow.category ?? "—"}\nКомментарий: ${flow.note ?? "—"}`,
          { reply_markup: confirmKeyboard },
        );
        return;
      }
      // Keep the existing one-line transaction parser as a fallback.
      const parsed = parseTransactionMessage(text);
      if (isParseError(parsed)) {
        await ctx.reply(parsed.error, { reply_markup: mainKeyboard });
        return;
      }
      await refreshRatesIfStale();
      const gel = convertToGel(parsed.amount, parsed.currency);
      await pool.query(
        "INSERT INTO transactions(user_id,type,amount,currency,amount_gel,category,note) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [uid, parsed.type, parsed.amount, parsed.currency, gel, parsed.category, parsed.note],
      );
      await ctx.reply("Операция записана.", { reply_markup: mainKeyboard });
    }),
  );

bot.callbackQuery(
    /^flow:(save|cancel)$/,
    safe("flow callback", async (ctx) => {
      const uid = ctx.from?.id;
      const match = ctx.match;
      if (!uid || !match) {
        await ctx.answerCallbackQuery({ text: "Не удалось определить действие", show_alert: true });
        return;
      }
      const action = match[1];
      const flow = flows.get(uid);
      if (action === "cancel") {
        flows.delete(uid);
        await ctx.answerCallbackQuery({ text: "Отменено" });
        await ctx.editMessageText("Действие отменено.").catch(() => {});
        return;
      }
      if (!flow?.amount || !flow.currency) {
        await ctx.answerCallbackQuery({ text: "Нет операции для сохранения", show_alert: true });
        return;
      }
      await refreshRatesIfStale();
      const gel = convertToGel(flow.amount, flow.currency);
      await pool.query(
        "INSERT INTO transactions(user_id,type,amount,currency,amount_gel,category,note) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [uid, flow.type, flow.amount, flow.currency, gel, flow.category ?? null, flow.note ?? null],
      );
      flows.delete(uid);
      await ctx.answerCallbackQuery({ text: "Сохранено" });
      await ctx.editMessageText("Операция записана.").catch(() => {});
    }),
  );
}
