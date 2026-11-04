import { donutSlices } from "@/shared/lib/donut";

/** Цвета категорий — токены --chart-1…8 (tokens.css). */
const CHART_COLORS = 8;

export const donutColor = (index: number): string => `var(--chart-${(index % CHART_COLORS) + 1})`;

/** Кольцо по категориям: цвет дуги совпадает с цветом точки в списке (donutColor по тому же индексу). */
export function DonutChart({ values, label, caption }: { values: number[]; label: string; caption: string }) {
  const slices = donutSlices(values);
  return (
    <div className="donut">
      <svg viewBox="0 0 42 42" role="img" aria-label={label}>
        <circle className="donut__track" cx="21" cy="21" r="15.915" />
        {slices.map((s, i) =>
          s.share > 0 ? (
            <circle
              key={i}
              cx="21"
              cy="21"
              r="15.915"
              pathLength={100}
              fill="none"
              style={{ stroke: donutColor(i) }}
              strokeWidth="5"
              strokeDasharray={`${Math.max(s.share - 0.6, 0.1)} ${100 - Math.max(s.share - 0.6, 0.1)}`}
              strokeDashoffset={25 - s.start}
            />
          ) : null,
        )}
      </svg>
      <span className="donut__caption">{caption}</span>
    </div>
  );
}
