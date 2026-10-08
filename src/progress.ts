// Glue between the pure rules (achievements.ts) and the database: gathers a snapshot of the
// user's data, evaluates it and persists what newly unlocked. Safe to call after any write —
// it is idempotent, and only the call that actually inserts a row reports it as "new".

import {
  ACHIEVEMENTS,
  evaluateProgress,
  summarizeDays,
  type AchievementDef,
  type Progress,
  type Rank,
  type StatsSnapshot,
} from "./achievements";
import { getSummaryForRange } from "./db";
import { getBudgetReport } from "./db/budget";
import { listGoals } from "./db/goals";
import {
  getGoalStats,
  getOperationDays,
  getOperationStats,
  getStoredRankIndex,
  insertNewAchievements,
  listUnlocked,
  raiseStoredRank,
} from "./db/progress";
import { getUserSettings } from "./db/settings";
import { zonedMonthBoundaries } from "./timezone";

const DAY_MS = 86_400_000;
const LIMIT_MONTHS_WINDOW = 6;

async function monthsWithinLimits(userId: number, timeZone: string, now: Date): Promise<number> {
  let count = 0;
  let cursor = zonedMonthBoundaries(now, timeZone).from;
  for (let i = 0; i < LIMIT_MONTHS_WINDOW; i++) {
    const month = zonedMonthBoundaries(new Date(cursor.getTime() - DAY_MS), timeZone);
    cursor = month.from;
    const rows = (await getBudgetReport(userId, month.from, month.to)).filter(
      (r) => r.effectiveLimitGel !== null,
    );
    if (rows.length > 0 && rows.every((r) => r.spentGel <= (r.effectiveLimitGel as number))) count++;
  }
  return count;
}

export async function gatherSnapshot(userId: number): Promise<StatsSnapshot> {
  const settings = await getUserSettings(userId);
  const now = new Date();
  const [ops, days, goalStats, goals, expenses, within] = await Promise.all([
    getOperationStats(userId, settings.timezone),
    getOperationDays(userId, settings.timezone),
    getGoalStats(userId),
    listGoals(userId),
    getSummaryForRange(userId, new Date(now.getTime() - 90 * DAY_MS), now),
    monthsWithinLimits(userId, settings.timezone, now),
  ]);
  const summary = summarizeDays(days);
  const savingsGel = goals.reduce((sum, g) => sum + Number(g.saved_gel), 0);
  const avgMonthlyExpenses = expenses.expense_gel / 3;
  return {
    operations: ops.operations,
    categorized: ops.categorized,
    nightOwl: ops.nightOwl,
    recordPoints: summary.recordPoints,
    bestStreakDays: summary.bestStreakDays,
    onboarded: settings.onboardedAt !== null,
    goalsCreated: goalStats.created,
    goalsReached: goalStats.reached,
    cushionMonths: avgMonthlyExpenses > 0 ? savingsGel / avgMonthlyExpenses : null,
    monthsWithinLimits: within,
  };
}

export interface ProgressChange {
  progress: Progress;
  newlyUnlocked: AchievementDef[];
  /** Set only when this very call raised the rank above the best one stored before. */
  rankedUpTo: Rank | null;
}

export async function syncProgress(userId: number): Promise<ProgressChange> {
  const [storedRank, stored] = await Promise.all([getStoredRankIndex(userId), listUnlocked(userId)]);
  const progress = evaluateProgress(await gatherSnapshot(userId), storedRank, [...stored.keys()]);
  const insertedCodes = await insertNewAchievements(userId, progress.unlockedCodes);
  const raised = await raiseStoredRank(userId, progress.rankIndex);
  return {
    progress,
    newlyUnlocked: ACHIEVEMENTS.filter((a) => insertedCodes.includes(a.code)),
    // A fresh user's first row (rank 0) is not a "rank up".
    rankedUpTo: raised && progress.rankIndex > 0 ? progress.rank : null,
  };
}
