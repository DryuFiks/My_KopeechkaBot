import { Bot } from "grammy";
import { closeGoal, contributeToGoal, createGoal, findGoal, listGoals } from "../db/goals";
import { confirmActionKeyboard, mainKeyboard } from "../keyboards";
import { editOrReply } from "../editOrReply";
import { escapeHtml, formatGoalProgress, renderScreen, PARSE_MODE } from "../format";
import { safe, safeCallback } from "../middleware/safe";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function renderGoalsScreen(userId: number) {
  const goals = await listGoals(userId);
  const text = renderScreen({
    title: "Цели накопления",
    lines: goals.map((g) =>
      formatGoalProgress({
        title: `${g.id}. ${g.title}`,
        savedGel: Number(g.saved_gel),
        targetGel: Number(g.target_gel),
        targetDate: g.target_date,
      }),
    ),
    emptyText: "Целей пока нет. Создай: /goal Название сумма [ГГГГ-ММ-ДД]",
  });
  return text;
}

export function registerGoalsHandlers(bot: Bot): void {
  bot.command(
    "goal",
    safe("goal", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const usage = "Формат: /goal Название сумма [ГГГГ-ММ-ДД]";
      const m = /^\/goal\s+(.+?)\s+(\d+(?:[.,]\d{1,2})?)(?:\s+(\S+))?\s*$/.exec(ctx.message?.text ?? "");
      if (!m) {
        await ctx.reply(await renderGoalsScreen(uid), { parse_mode: PARSE_MODE, reply_markup: mainKeyboard });
        return;
      }
      let targetDate: string | null = null;
      if (m[3]) {
        if (!isValidCalendarDate(m[3])) {
          await ctx.reply(`Дата должна быть в формате ГГГГ-ММ-ДД. ${usage}`, { reply_markup: mainKeyboard });
          return;
        }
        targetDate = m[3];
      }
      await createGoal(uid, m[1].trim().slice(0, 120), Number(m[2].replace(",", ".")), targetDate);
      await ctx.reply("Цель накопления создана.", { reply_markup: mainKeyboard });
    }),
  );

  bot.command(
    "save",
    safe("save", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const m = /^\/save\s+(\d+)\s+(\d+(?:[.,]\d{1,2})?)\s*$/.exec(ctx.message?.text ?? "");
      if (!m) {
        await ctx.reply("Формат: /save ID_цели сумма", { reply_markup: mainKeyboard });
        return;
      }
      const goal = await contributeToGoal(uid, Number(m[1]), Number(m[2].replace(",", ".")));
      if (!goal) {
        await ctx.reply("Цель не найдена.", { reply_markup: mainKeyboard });
        return;
      }
      const text = formatGoalProgress({
        title: goal.title,
        savedGel: Number(goal.saved_gel),
        targetGel: Number(goal.target_gel),
        targetDate: goal.target_date,
      });
      await ctx.reply(text, { parse_mode: PARSE_MODE, reply_markup: mainKeyboard });
    }),
  );

  bot.callbackQuery(
    "action:goals",
    safeCallback("action:goals", async (ctx) => {
      await editOrReply(ctx, await renderGoalsScreen(ctx.from.id), {
        reply_markup: mainKeyboard,
        parse_mode: PARSE_MODE,
      });
    }),
  );

  bot.command(
    "deletegoal",
    safe("deletegoal", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const id = Number((ctx.message?.text ?? "").split(/\s+/)[1]);
      const goal = await findGoal(uid, id);
      if (!goal) {
        await ctx.reply("Цель не найдена.", { reply_markup: mainKeyboard });
        return;
      }
      await ctx.reply(`Закрыть цель «${escapeHtml(goal.title)}»?`, {
        parse_mode: PARSE_MODE,
        reply_markup: confirmActionKeyboard(`delgoal:${id}:yes`, `delgoal:${id}:no`),
      });
    }),
  );

  bot.callbackQuery(
    /^delgoal:(\d+):(yes|no)$/,
    safeCallback("deletegoal confirm", async (ctx) => {
      if (ctx.match[2] === "no") {
        await ctx.answerCallbackQuery({ text: "Отменено" });
        await ctx.editMessageText("Действие отменено.", { reply_markup: mainKeyboard }).catch(() => {});
        return;
      }
      const closed = await closeGoal(ctx.from.id, Number(ctx.match[1]));
      await ctx.answerCallbackQuery({ text: closed ? "Цель закрыта" : "Уже закрыта" });
      await ctx
        .editMessageText(closed ? "Цель закрыта." : "Цель уже закрыта или не найдена.", {
          reply_markup: mainKeyboard,
        })
        .catch(() => {});
    }),
  );
}
