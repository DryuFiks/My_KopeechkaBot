import { Context, InlineKeyboard } from "grammy";
import { logger } from "./logger";

export interface EditOrReplyOptions {
  reply_markup?: InlineKeyboard;
  parse_mode?: "HTML";
}

/**
 * Edits the current message, or sends a fresh reply if Telegram refuses the edit
 * (message too old/deleted, or unchanged content) — navigation must never fail silently.
 */
export async function editOrReply(
  ctx: Context,
  text: string,
  options: EditOrReplyOptions = {},
): Promise<void> {
  try {
    await ctx.editMessageText(text, options);
  } catch (err) {
    logger.warn(`editOrReply: editMessageText failed, falling back to reply: ${(err as Error).message}`);
    await ctx.reply(text, options);
  }
}
