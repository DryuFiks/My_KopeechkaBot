// Pure ranks & achievements rules (no DB, no I/O). XP is derived from a snapshot of the
// user's own data, never "earned" by separate counters, so re-evaluating is always safe and
// nothing is ever counted twice. Gamification rewards habits (recording, saving, planning),
// not spending less at any cost: nothing here shames the user, and ranks never go down.

export interface DayCount {
  /** Calendar day in the user's timezone, YYYY-MM-DD. */
  day: string;
  count: number;
}

export interface DaySummary {
  /** 2 points per recorded operation, at most 10 operations per day (no farming). */
  recordPoints: number;
  bestStreakDays: number;
}

const DAY_MS = 86_400_000;
const POINTS_PER_OPERATION = 2;
const MAX_COUNTED_PER_DAY = 10;

function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function summarizeDays(days: DayCount[]): DaySummary {
  const sorted = [...days]
    .filter((d) => d.count > 0)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  let recordPoints = 0;
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    recordPoints += Math.min(d.count, MAX_COUNTED_PER_DAY) * POINTS_PER_OPERATION;
    const n = dayNumber(d.day);
    run = prev !== null && n === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = n;
  }
  return { recordPoints, bestStreakDays: best };
}

/** Everything the rules need, gathered from the DB by the caller. */
export interface StatsSnapshot {
  operations: number;
  categorized: number;
  recordPoints: number;
  bestStreakDays: number;
  /** Recorded an operation between 00:00 and 05:00 local time. */
  nightOwl: boolean;
  onboarded: boolean;
  goalsCreated: number;
  goalsReached: number;
  /** Savings divided by average monthly expenses; null when there are no expenses to compare with. */
  cushionMonths: number | null;
  /** Completed months (of the last six) in which every category with a limit stayed within it. */
  monthsWithinLimits: number;
}

export interface AchievementDef {
  code: string;
  emoji: string;
  title: string;
  description: string;
  xp: number;
  unlocked: (s: StatsSnapshot) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    code: "first_kopeyka",
    emoji: "🥇",
    title: "Первая копеечка",
    description: "Запишите первую операцию",
    xp: 20,
    unlocked: (s) => s.operations >= 1,
  },
  {
    code: "planner",
    emoji: "🗓",
    title: "Планировщик",
    description: "Заполните план месяца",
    xp: 50,
    unlocked: (s) => s.onboarded,
  },
  {
    code: "goal_setter",
    emoji: "🧭",
    title: "Целеустремлённый",
    description: "Создайте первую цель накоплений",
    xp: 20,
    unlocked: (s) => s.goalsCreated >= 1,
  },
  {
    code: "week_streak",
    emoji: "🔥",
    title: "Неделя без пропусков",
    description: "Записывайте операции 7 дней подряд",
    xp: 80,
    unlocked: (s) => s.bestStreakDays >= 7,
  },
  {
    code: "month_streak",
    emoji: "🏆",
    title: "Месяц привычки",
    description: "Записывайте операции 30 дней подряд",
    xp: 250,
    unlocked: (s) => s.bestStreakDays >= 30,
  },
  {
    code: "sherlock",
    emoji: "🕵️",
    title: "Шерлок кошелька",
    description: "Укажите категорию у 50 операций",
    xp: 60,
    unlocked: (s) => s.categorized >= 50,
  },
  {
    code: "hundred_ops",
    emoji: "💯",
    title: "Сотня записей",
    description: "Запишите 100 операций",
    xp: 100,
    unlocked: (s) => s.operations >= 100,
  },
  {
    code: "night_accountant",
    emoji: "🌙",
    title: "Ночной бухгалтер",
    description: "Запишите операцию после полуночи",
    xp: 10,
    unlocked: (s) => s.nightOwl,
  },
  {
    code: "sharpshooter",
    emoji: "🎯",
    title: "Снайпер лимитов",
    description: "Закончите месяц, не выйдя ни за один лимит",
    xp: 150,
    unlocked: (s) => s.monthsWithinLimits >= 1,
  },
  {
    code: "cushion",
    emoji: "🛟",
    title: "Подушка надулась",
    description: "Накопите на 3 месяца расходов",
    xp: 200,
    unlocked: (s) => s.cushionMonths !== null && s.cushionMonths >= 3,
  },
  {
    code: "goal_reached",
    emoji: "🧳",
    title: "Цель достигнута",
    description: "Накопите всю сумму одной из целей",
    xp: 150,
    unlocked: (s) => s.goalsReached >= 1,
  },
];

export interface Rank {
  emoji: string;
  title: string;
  minXp: number;
}

export const RANKS: Rank[] = [
  { emoji: "🪙", title: "Копеечный птенец", minXp: 0 },
  { emoji: "🐹", title: "Хомяк-запасливый", minXp: 100 },
  { emoji: "🧮", title: "Счетовод-любитель", minXp: 300 },
  { emoji: "🛡", title: "Страж кошелька", minXp: 700 },
  { emoji: "🦉", title: "Мудрая сова бюджета", minXp: 1500 },
  { emoji: "🐉", title: "Дракон накоплений", minXp: 3000 },
  { emoji: "👑", title: "Гуру копеечного хранения", minXp: 6000 },
];

export function rankIndexForXp(xp: number): number {
  let index = 0;
  RANKS.forEach((r, i) => {
    if (xp >= r.minXp) index = i;
  });
  return index;
}

export interface Progress {
  xp: number;
  rankIndex: number;
  rank: Rank;
  /** null at the top rank. */
  next: { rank: Rank; xpLeft: number } | null;
  unlockedCodes: string[];
}

/**
 * Evaluates a snapshot. Two things are "sticky" so deleting data (e.g. /undo) never takes
 * anything away: `storedRankIndex` (the shown rank is never lower than the best reached) and
 * `previouslyUnlocked` (an achievement stays earned, and keeps its XP, once unlocked).
 */
export function evaluateProgress(
  s: StatsSnapshot,
  storedRankIndex = 0,
  previouslyUnlocked: string[] = [],
): Progress {
  const unlocked = ACHIEVEMENTS.filter((a) => previouslyUnlocked.includes(a.code) || a.unlocked(s));
  const xp = s.recordPoints + unlocked.reduce((sum, a) => sum + a.xp, 0);
  const rankIndex = Math.max(rankIndexForXp(xp), storedRankIndex);
  const nextRank = RANKS[rankIndex + 1];
  return {
    xp,
    rankIndex,
    rank: RANKS[rankIndex],
    next: nextRank ? { rank: nextRank, xpLeft: Math.max(0, nextRank.minXp - xp) } : null,
    unlockedCodes: unlocked.map((a) => a.code),
  };
}
