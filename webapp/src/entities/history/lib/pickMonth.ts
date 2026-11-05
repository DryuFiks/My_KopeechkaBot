/**
 * Выбранный месяц и месяц перед ним по времени. `months` — как отдаёт /api/history: от новых к старым,
 * поэтому по умолчанию берётся первый, а «прошлый» — следующий элемент массива.
 */
export function pickMonth<T extends { month: string }>(
  months: T[],
  picked: string | undefined,
): { selected: T | undefined; previous: T | undefined } {
  const found = months.findIndex((m) => m.month === picked);
  const at = found >= 0 ? found : 0;
  return { selected: months[at], previous: months[at + 1] };
}
