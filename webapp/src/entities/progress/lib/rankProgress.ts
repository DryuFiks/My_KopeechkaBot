/** Доля пути от текущего ранга к следующему, 0–100; на высшем ранге — 100. */
export function rankProgressPercent(xp: number, currentMinXp: number, nextMinXp: number | null): number {
  if (nextMinXp === null) return 100;
  const span = nextMinXp - currentMinXp;
  if (span <= 0) return 100;
  const value = ((xp - currentMinXp) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(value)));
}
