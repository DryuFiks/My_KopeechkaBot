import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  RANKS,
  evaluateProgress,
  rankIndexForXp,
  summarizeDays,
  type StatsSnapshot,
} from "./achievements";

const empty: StatsSnapshot = {
  operations: 0,
  categorized: 0,
  recordPoints: 0,
  bestStreakDays: 0,
  nightOwl: false,
  onboarded: false,
  goalsCreated: 0,
  goalsReached: 0,
  cushionMonths: null,
  monthsWithinLimits: 0,
};

describe("summarizeDays", () => {
  it("gives 2 points per operation, capped at 10 operations a day", () => {
    expect(summarizeDays([{ day: "2026-10-01", count: 3 }]).recordPoints).toBe(6);
    expect(summarizeDays([{ day: "2026-10-01", count: 50 }]).recordPoints).toBe(20);
  });
  it("finds the best run of consecutive days across month boundaries", () => {
    const days = ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06"].map(
      (day) => ({
        day,
        count: 1,
      }),
    );
    expect(summarizeDays(days).bestStreakDays).toBe(4);
  });
  it("ignores empty days and unsorted input, and handles no data", () => {
    expect(summarizeDays([]).bestStreakDays).toBe(0);
    const days = [
      { day: "2026-10-03", count: 1 },
      { day: "2026-10-01", count: 1 },
      { day: "2026-10-02", count: 0 },
    ];
    expect(summarizeDays(days).bestStreakDays).toBe(1);
  });
});

describe("ranks", () => {
  it("picks the highest rank whose threshold is reached", () => {
    expect(rankIndexForXp(0)).toBe(0);
    expect(rankIndexForXp(99)).toBe(0);
    expect(rankIndexForXp(100)).toBe(1);
    expect(rankIndexForXp(99999)).toBe(RANKS.length - 1);
  });
  it("has strictly increasing thresholds and unique achievement codes", () => {
    RANKS.slice(1).forEach((r, i) => expect(r.minXp).toBeGreaterThan(RANKS[i].minXp));
    expect(new Set(ACHIEVEMENTS.map((a) => a.code)).size).toBe(ACHIEVEMENTS.length);
  });
});

describe("evaluateProgress", () => {
  it("starts at the first rank with nothing unlocked", () => {
    const p = evaluateProgress(empty);
    expect(p.xp).toBe(0);
    expect(p.rank.title).toBe("Копеечный птенец");
    expect(p.unlockedCodes).toEqual([]);
    expect(p.next?.xpLeft).toBe(100);
  });
  it("adds record points and achievement XP", () => {
    const p = evaluateProgress({ ...empty, operations: 1, recordPoints: 2, onboarded: true });
    expect(p.unlockedCodes).toEqual(["first_kopeyka", "planner"]);
    expect(p.xp).toBe(2 + 20 + 50);
  });
  it("never shows a rank lower than the stored one", () => {
    const p = evaluateProgress(empty, 3);
    expect(p.rankIndex).toBe(3);
    expect(p.rank.title).toBe("Страж кошелька");
  });
  it("keeps an unlocked achievement and its XP even when the data behind it is gone", () => {
    const p = evaluateProgress(empty, 0, ["goal_reached", "week_streak"]);
    expect(p.unlockedCodes).toEqual(["week_streak", "goal_reached"]);
    expect(p.xp).toBe(80 + 150);
  });
  it("has no next rank at the top", () => {
    expect(evaluateProgress({ ...empty, recordPoints: 99999 }).next).toBeNull();
  });
  it("needs 3 months of cushion, and a null cushion never unlocks it", () => {
    expect(evaluateProgress({ ...empty, cushionMonths: 2.9 }).unlockedCodes).not.toContain("cushion");
    expect(evaluateProgress({ ...empty, cushionMonths: 3 }).unlockedCodes).toContain("cushion");
    expect(evaluateProgress({ ...empty, cushionMonths: null }).unlockedCodes).not.toContain("cushion");
  });
});
