import { api } from "@/shared/api/client";
import { createBus } from "@/shared/lib/events";

export interface RankInfo {
  index: number;
  emoji: string;
  title: string;
  minXp: number;
}

export interface NextRank {
  emoji: string;
  title: string;
  minXp: number;
  xpLeft: number;
}

export interface Achievement {
  code: string;
  emoji: string;
  title: string;
  description: string;
  xp: number;
  unlockedAt: string | null;
}

export interface ProgressData {
  xp: number;
  rank: RankInfo;
  next: NextRank | null;
  ranksTotal: number;
  achievements: Achievement[];
  /** Коды достижений, открытых именно этим запросом — по ним показываем тост один раз. */
  newlyUnlocked: string[];
  rankedUp: { emoji: string; title: string } | null;
}

/** Каждый ответ сервера о прогрессе проходит через шину: тосты не зависят от того, кто запросил. */
export const progressBus = createBus<ProgressData>();

export async function fetchProgress(): Promise<ProgressData> {
  const data = await api.get<ProgressData>("/progress");
  progressBus.emit(data);
  return data;
}
