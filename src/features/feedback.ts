import { Bot } from "grammy";
import { submitFeedback, type FeedbackResult } from "../feedback";
import { MAX_FEEDBACK } from "../feedbackRules";
import { mainKeyboard } from "../keyboards";
import { safe } from "../middleware/safe";

const REPLY: Record<FeedbackResult, string> = {
  sent: "Спасибо! Сообщение отправлено разработчику.",
  empty: "Напишите отзыв сразу после команды, одним сообщением. Например:\n/feedback Хочу выгрузку в Excel",
  too_long: `Слишком длинно — уместите, пожалуйста, в ${MAX_FEEDBACK} символов.`,
  too_soon: "Сообщение уже отправлено. Следующее можно через полминуты.",
  unavailable: "Отправка отзывов сейчас недоступна.",
};

/** MKB-047: /feedback <текст> — пересылается администратору. */
export function registerFeedbackHandlers(bot: Bot): void {
  bot.command(
    "feedback",
    safe("/feedback", async (ctx) => {
      if (!ctx.from) return;
      const user = { id: ctx.from.id, name: ctx.from.first_name, username: ctx.from.username };
      const result = await submitFeedback(ctx.api, user, ctx.match, "bot");
      await ctx.reply(REPLY[result], { reply_markup: mainKeyboard });
    }),
  );
}
