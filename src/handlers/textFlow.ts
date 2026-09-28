import { Bot } from "grammy";
import { pool } from "../db";
import { confirmKeyboard, mainKeyboard } from "../keyboards";
import { convertToGel, refreshRatesIfStale } from "../currency";
import { parseTransactionMessage, isParseError } from "../parser";
import { flows } from "../features/common";
import { safe, safeCallback } from "../middleware/safe";

/**
 * The single message:text handler for the bot: drives the multi-step add-transaction
 * wizard (Flow) when one is active, and otherwise keeps the classic one-line
 * "-150 gel еда обед" format working as a quick path.
 */
export function registerTextFlowHandlers(bot: Bot): void {
  bot.on(
    "message:text",
    safe("text flow", async (ctx) => {
      const uid = ctx.from?.id;
      const text = ctx.message.text.trim();
      if (!uid || text.startsWith("/")) return;

      const flow = flows.get(uid);
      if (flow) {
        const parsed = parseTransactionMessage(text);
        if (isParseError(parsed)) {
          await ctx.reply(parsed.error);
          return;
        }
        if (parsed.type !== flow.type) {
          await ctx.reply(
            `Для этого шага нужен ${flow.type === "expense" ? "расход (минус)" : "доход (плюс)"}.`,
          );
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

      // No active wizard — keep the classic one-line format working as a quick path.
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
    safeCallback("flow callback", async (ctx) => {
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
