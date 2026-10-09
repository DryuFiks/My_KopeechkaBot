import { Bot, Context } from "grammy";
import { getCategoryOptions } from "../categoryOptions";
import { getUserSettings } from "../db/settings";
import { editOrReply } from "../editOrReply";
import { Flow, flows } from "../features/common";
import { formatSignedAmount } from "../format";
import {
  cancelKeyboard,
  categoryKeyboard,
  commentKeyboard,
  currencyKeyboard,
  flowConfirmKeyboard,
} from "../keyboards";
import { isSupportedCurrency, type SupportedCurrency } from "../currencies";
import { safeCallback } from "../middleware/safe";
import type { TransactionType } from "../parser";

export function confirmText(flow: Flow): string {
  return `Проверь операцию:\n${formatSignedAmount(flow.type, flow.amount ?? 0, flow.currency ?? "GEL")}\nКатегория: ${flow.category ?? "—"}\nКомментарий: ${flow.note ?? "—"}`;
}

/** Shown after the category is chosen: only a number is needed now. */
export function amountPrompt(flow: Flow): string {
  const what = flow.type === "expense" ? "расхода" : "дохода";
  return `Категория: ${flow.category ?? "без категории"}\nВалюта: ${flow.currency ?? "GEL"}\n\nВведи сумму ${what} числом, например 25 или 25.5`;
}

/** Begins the wizard: currency → category → amount → confirm (with an optional comment). */
export async function startAddFlow(ctx: Context, userId: number, type: TransactionType): Promise<void> {
  const { displayCurrency } = await getUserSettings(userId);
  flows.set(userId, { type, stage: "currency" });
  const title = type === "expense" ? "➖ Расход" : "➕ Доход";
  await editOrReply(ctx, `${title}\nВыбери валюту:`, { reply_markup: currencyKeyboard(displayCurrency) });
}

/** Moves to the category step; used by the currency tap and available to the text handler. */
export async function showCategoryStep(ctx: Context, userId: number, flow: Flow): Promise<void> {
  const categories = await getCategoryOptions(userId, flow.type);
  flow.categoryOptions = categories;
  flow.stage = "category";
  const text = `Валюта: ${flow.currency}\nВыбери категорию, добавь новую кнопкой ниже или пришли название:`;
  await editOrReply(ctx, text, { reply_markup: categoryKeyboard(categories) });
}

export function registerAddFlowHandlers(bot: Bot): void {
  bot.callbackQuery(
    /^cur:([A-Z]{3})$/,
    safeCallback("currency select", async (ctx) => {
      const uid = ctx.from?.id;
      const flow = uid ? flows.get(uid) : undefined;
      const code = ctx.match[1];
      if (!uid || !flow || flow.stage !== "currency" || !isSupportedCurrency(code)) {
        await ctx.answerCallbackQuery({ text: "Сценарий уже завершён или отменён", show_alert: true });
        return;
      }
      flow.currency = code as SupportedCurrency;
      await ctx.answerCallbackQuery();
      await showCategoryStep(ctx, uid, flow);
    }),
  );

  bot.callbackQuery(
    "cat:new",
    safeCallback("category new", async (ctx) => {
      const uid = ctx.from?.id;
      const flow = uid ? flows.get(uid) : undefined;
      if (!uid || !flow || flow.stage !== "category") {
        await ctx.answerCallbackQuery({ text: "Сценарий уже завершён или отменён", show_alert: true });
        return;
      }
      flow.stage = "newCategory";
      await ctx.answerCallbackQuery();
      await ctx
        .editMessageText("Пришли название новой категории (до 60 символов):", {
          reply_markup: cancelKeyboard,
        })
        .catch(() => {});
    }),
  );

  bot.callbackQuery(
    "flow:comment",
    safeCallback("comment ask", async (ctx) => {
      const uid = ctx.from?.id;
      const flow = uid ? flows.get(uid) : undefined;
      if (!uid || !flow || flow.stage !== "confirm") {
        await ctx.answerCallbackQuery({ text: "Сценарий уже завершён или отменён", show_alert: true });
        return;
      }
      flow.stage = "comment";
      await ctx.answerCallbackQuery();
      await ctx
        .editMessageText("Пришли комментарий к операции (до 200 символов) или нажми «Без комментария».", {
          reply_markup: commentKeyboard,
        })
        .catch(() => {});
    }),
  );

  bot.callbackQuery(
    "flow:nocomment",
    safeCallback("comment skip", async (ctx) => {
      const uid = ctx.from?.id;
      const flow = uid ? flows.get(uid) : undefined;
      if (!uid || !flow || flow.stage !== "comment") {
        await ctx.answerCallbackQuery({ text: "Сценарий уже завершён или отменён", show_alert: true });
        return;
      }
      flow.note = null;
      flow.stage = "confirm";
      await ctx.answerCallbackQuery();
      await ctx
        .editMessageText(confirmText(flow), { reply_markup: flowConfirmKeyboard(false) })
        .catch(() => {});
    }),
  );
}
