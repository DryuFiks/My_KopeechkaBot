import { Context } from "grammy";
import { mainKeyboard } from "../keyboards";
import { logger } from "../logger";

/** Thrown for input the user can fix themselves — the message is shown to them as-is. */
export class UserInputError extends Error {}

const GENERIC_ERROR_MESSAGE = "Что-то пошло не так. Попробуй ещё раз чуть позже.";
const TRANSIENT_ERROR_MESSAGE = "Временная проблема с базой данных. Попробуй ещё раз через минуту.";
const TRANSIENT_PATTERN = /ECONNREFUSED|ETIMEDOUT|ECONNRESET|timeout|connection terminated/i;

function messageForError(err: unknown): string {
  if (err instanceof UserInputError) return err.message;
  const text = err instanceof Error ? err.message : String(err);
  if (TRANSIENT_PATTERN.test(text)) return TRANSIENT_ERROR_MESSAGE;
  return GENERIC_ERROR_MESSAGE;
}

function logFailure(label: string, err: unknown): void {
  logger.error(`${label} failed: ${err instanceof Error ? err.message : String(err)}`);
}

/** Wraps a command/message handler so an unexpected error is logged and never leaks details to the user. */
export function safe<C extends Context>(
  label: string,
  fn: (ctx: C) => Promise<void>,
): (ctx: C) => Promise<void> {
  return async (ctx) => {
    try {
      await fn(ctx);
    } catch (err) {
      logFailure(label, err);
      await ctx.reply(messageForError(err), { reply_markup: mainKeyboard }).catch(() => {
        // Telegram API hiccup on the error reply itself — already logged above.
      });
    }
  };
}

type AnswerFn = Context["answerCallbackQuery"];

/**
 * Wraps a callback-query handler: guarantees answerCallbackQuery is sent exactly once
 * (even on an unhandled exception), so Telegram never shows a stuck "loading" spinner.
 * Handlers may still call ctx.answerCallbackQuery() themselves with a custom message —
 * this wrapper only fills in the call when the handler didn't make it.
 */
export function safeCallback<C extends Context>(
  label: string,
  fn: (ctx: C) => Promise<void>,
): (ctx: C) => Promise<void> {
  return async (ctx) => {
    if (!ctx.callbackQuery) {
      return safe(label, fn)(ctx);
    }
    let answered = false;
    const originalAnswer: AnswerFn = ctx.answerCallbackQuery.bind(ctx);
    ctx.answerCallbackQuery = (async (...args: Parameters<AnswerFn>) => {
      answered = true;
      return originalAnswer(...args);
    }) as AnswerFn;

    try {
      await fn(ctx);
    } catch (err) {
      logFailure(label, err);
      if (!answered) {
        await originalAnswer({ text: messageForError(err), show_alert: true }).catch(() => {});
      }
      return;
    }
    if (!answered) {
      await originalAnswer().catch(() => {});
    }
  };
}
