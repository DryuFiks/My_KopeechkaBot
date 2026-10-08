import { Controller, Get, UseGuards } from "@nestjs/common";
import { ACHIEVEMENTS, RANKS } from "../../achievements";
import { listUnlocked } from "../../db/progress";
import { syncProgress } from "../../progress";
import type { WebAppUser } from "../../telegramAuth";
import { TelegramAuthGuard, WebUser } from "./auth.guard";

@Controller("api")
@UseGuards(TelegramAuthGuard)
export class ProgressController {
  /**
   * Current rank, XP and every achievement. Also re-checks the rules, so opening the screen
   * picks up anything earned elsewhere; `newlyUnlocked`/`rankedUp` are only set for the call
   * that actually unlocked something (so a toast is shown once).
   */
  @Get("progress")
  async progress(@WebUser() user: WebAppUser) {
    const change = await syncProgress(user.id);
    const unlocked = await listUnlocked(user.id);
    const p = change.progress;
    return {
      xp: p.xp,
      rank: { index: p.rankIndex, emoji: p.rank.emoji, title: p.rank.title, minXp: p.rank.minXp },
      next: p.next && {
        emoji: p.next.rank.emoji,
        title: p.next.rank.title,
        minXp: p.next.rank.minXp,
        xpLeft: p.next.xpLeft,
      },
      ranksTotal: RANKS.length,
      achievements: ACHIEVEMENTS.map((a) => ({
        code: a.code,
        emoji: a.emoji,
        title: a.title,
        description: a.description,
        xp: a.xp,
        unlockedAt: unlocked.get(a.code)?.toISOString() ?? null,
      })),
      newlyUnlocked: change.newlyUnlocked.map((a) => a.code),
      rankedUp: change.rankedUpTo ? { emoji: change.rankedUpTo.emoji, title: change.rankedUpTo.title } : null,
    };
  }
}
