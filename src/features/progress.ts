import { Bot, Context } from "grammy";
import { ACHIEVEMENTS, RANKS } from "../achievements";
import { listUnlocked } from "../db/progress";
import { logger } from "../logger";
import { mainKeyboard } from "../keyboards";
import { safe } from "../middleware/safe";
import { syncProgress } from "../progress";

/**
 * Re-checks a user's progress after something they did and, only if something is new,
 * sends one short message. Never throws: a hiccup here must not break the action that
 * triggered it (the operation is already saved).
 */
export async function announceProgress(ctx: Context, userId: number): Promise<void> {
  try {
    const change = await syncProgress(userId);
    const lines = change.newlyUnlocked.map((a) => `🏅 Достижение: ${a.emoji} ${a.title} (+${a.xp} XP)`);
    if (change.rankedUpTo) lines.push(`⬆️ Новый ранг: ${change.rankedUpTo.emoji} ${change.rankedUpTo.title}`);
    if (lines.length > 0) await ctx.reply(lines.join("\n"));
  } catch (err) {
    logger.warn(`Progress check failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function registerProgressHandlers(bot: Bot): void {
  bot.command(
    "rank",
    safe("rank", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const { progress } = await syncProgress(uid);
      const unlocked = await listUnlocked(uid);
      const next = progress.next
        ? `До «${progress.next.rank.emoji} ${progress.next.rank.title}» осталось ${progress.next.xpLeft} XP`
        : "Это высший ранг — вы мастер копеечного хранения!";
      const lines = [
        `${progress.rank.emoji} ${progress.rank.title}`,
        `Опыт: ${progress.xp} XP (ранг ${progress.rankIndex + 1} из ${RANKS.length})`,
        next,
        "",
        "Достижения:",
        ...ACHIEVEMENTS.map((a) =>
          unlocked.has(a.code)
            ? `✅ ${a.emoji} ${a.title} — ${a.description}`
            : `🔒 ${a.title} — ${a.description}`,
        ),
        "",
        "Опыт дают регулярные записи, цели, план месяца и накопления. Ранг никогда не понижается.",
      ];
      await ctx.reply(lines.join("\n"), { reply_markup: mainKeyboard });
    }),
  );
}
