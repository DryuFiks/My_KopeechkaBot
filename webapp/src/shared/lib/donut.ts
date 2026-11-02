export interface DonutSlice {
  /** Доля от суммы, 0–100. */
  share: number;
  /** С какого процента окружности начинается дуга. */
  start: number;
}

/** Дуги кольца для значений по порядку; отрицательные и нулевые значения дуг не получают. */
export function donutSlices(values: number[]): DonutSlice[] {
  const total = values.reduce((sum, v) => sum + Math.max(v, 0), 0);
  let start = 0;
  return values.map((v) => {
    const share = total > 0 ? (Math.max(v, 0) / total) * 100 : 0;
    const slice = { share, start };
    start += share;
    return slice;
  });
}
