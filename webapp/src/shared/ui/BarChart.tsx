/** Столбики по дням: высота пропорциональна максимуму; значения доступны через title и подпись. */
export function BarChart({ values, total, label }: { values: number[]; total: number; label: string }) {
  const max = Math.max(...values, 1);
  const w = 100 / Math.max(total, values.length, 1);
  return (
    <svg className="barchart" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={label}>
      {values.map((v, i) => {
        const h = (v / max) * 38;
        return (
          <rect key={i} x={i * w + w * 0.1} y={40 - h} width={w * 0.8} height={Math.max(h, v > 0 ? 0.6 : 0)} rx={0.4}>
            <title>{`${i + 1}: ${v.toFixed(2)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
