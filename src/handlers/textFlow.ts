import { Bot, Context } from "grammy";
import { deleteTransactionById, getBalanceOverview, getRecentCategories, insertTransaction } from "../db";
import { categoryKeyboard, confirmKeyboard, emptyKeyboard, mainKeyboard, undoKeyboard } from "../keyboards";
import { convertToGel, refreshRatesIfStale } from "../currency";
import { parseAmountLine, parseTransactionMessage, isParseError } from "../parser";
import { formatBalanceOverview, formatSignedAmount, PARSE_MODE } from "../format";
import { Flow, flows } from "../features/common";
import { safe, safeCallback } from "../middleware/safe";

function confirmText(flow: Flow): string {
  return `Проверь операцию:\n${formatSignedAmount(flow.type, flow.amount ?? 0, flow.currency ?? "GEL")}\nКатегория: ${flow.category ?? "—"}\nКомментарий: ${flow.note ?? "—"}`;
}

async function promptCategoryStage(ctx: Context, uid: number, flow: Flow): Promise<void> {
  const categories = await getRecentCategories(uid, flow.type);
  flow.categoryOptions = categories;
  flow.stage = "category";
  await ctx.reply("Выбери категорию или пришли своё название:", {
    reply_markup: categoryKeyboard(categories),
  });
}

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
        if (flow.stage === "amount") {
          const parsed = parseAmountLine(text);
          if (isParseError(parsed)) {
            await ctx.reply(parsed.error);
            return;
          }
          flow.amount = parsed.amount;
          flow.currency = parsed.currency;
          flow.note = parsed.note;
          if (parsed.category) {
            flow.category = parsed.category;
            flow.stage = "confirm";
            await ctx.reply(confirmText(flow), { reply_markup: confirmKeyboard });
            return;
          }
          await promptCategoryStage(ctx, uid, flow);
          return;
        }

        if (flow.stage === "category") {
          const name = text.trim().slice(0, 60);
          if (!name) {
            await ctx.reply("Пришли название категории или выбери из списка.");
            return;
          }
          flow.category = name;
          flow.stage = "confirm";
          await ctx.reply(confirmText(flow), { reply_markup: confirmKeyboard });
          return;
        }

        // stage === "confirm" — stray text instead of a button tap; the flow stays as-is.
        await ctx.reply("Используй кнопки ниже, чтобы сохранить или отменить.", {
          reply_markup: confirmKeyboard,
        });
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
      const saved = await insertTransaction({
        userId: uid,
        type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency,
        amountGel: gel,
        category: parsed.category,
        note: parsed.note,
      });
      await ctx.reply("Операция записана.", { reply_markup: undoKeyboard(saved.id) });
    }),
  );

  bot.callbackQuery(
    /^cat:(none|\d+)$/,
    safeCallback("cat select", async (ctx) => {
      const uid = ctx.from?.id;
      const flow = uid ? flows.get(uid) : undefined;
      if (!uid || !flow || flow.stage !== "category") {
        await ctx.answerCallbackQuery({ text: "Сценарий уже завершён или отменён", show_alert: true });
        return;
      }
      const raw = ctx.match[1];
      if (raw === "none") {
        flow.category = null;
      } else {
        const name = flow.categoryOptions?.[Number(raw)];
        if (!name) {
          await ctx.answerCallbackQuery({
            text: "Эта категория больше не действует, выбери другую",
            show_alert: true,
          });
          return;
        }
        flow.category = name;
      }
      flow.stage = "confirm";
      await ctx.editMessageText(confirmText(flow), { reply_markup: confirmKeyboard }).catch(() => {});
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
      if (match[1] === "cancel") {
        flows.delete(uid);
        await ctx.answerCallbackQuery({ text: "Отменено" });
        await ctx.editMessageText("Действие отменено.", { reply_markup: emptyKeyboard }).catch(() => {});
        return;
      }

      // Delete the flow synchronously, before any await, so a duplicate callback
      // delivery or a fast double-tap can't insert the same transaction twice.
      const flow = flows.get(uid);
      flows.delete(uid);
      if (!flow?.amount || !flow.currency) {
        await ctx.answerCallbackQuery({ text: "Нет операции для сохранения", show_alert: true });
        return;
      }

      await refreshRatesIfStale();
      const gel = convertToGel(flow.amount, flow.currency);
      const saved = await insertTransaction({
        userId: uid,
        type: flow.type,
        amount: flow.amount,
        currency: flow.currency,
        amountGel: gel,
        category: flow.category ?? null,
        note: flow.note ?? null,
      });

      const overview = await getBalanceOverview(uid);
      const text = [
        `${formatSignedAmount(flow.type, flow.amount, flow.currency)} сохранено.`,
        formatBalanceOverview(overview),
      ].join("\n\n");
      await ctx.answerCallbackQuery({ text: "Сохранено" });
      await ctx
        .editMessageText(text, { reply_markup: undoKeyboard(saved.id), parse_mode: PARSE_MODE })
        .catch(() => {});
    }),
  );

  bot.callbackQuery(
    /^undo:(\d+)$/,
    safeCallback("undo", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) {
        await ctx.answerCallbackQuery();
        return;
      }
      const deleted = await deleteTransactionById(uid, Number(ctx.match[1]));
      if (!deleted) {
        await ctx.answerCallbackQuery({ text: "Нечего отменять — уже отменено", show_alert: true });
        return;
      }
      await ctx.answerCallbackQuery({ text: "Отменено" });
      await ctx
        .editMessageText(`Отменено: ${formatSignedAmount(deleted.type, deleted.amount, deleted.currency)}`, {
          reply_markup: emptyKeyboard,
        })
        .catch(() => {});
    }),
  );
}
