import { Card, ProgressBar } from "@/shared/ui";
import { formatGel } from "@/shared/lib/money";
import { suggestSplit } from "../lib/split";

export function SplitCard({ income }: { income: number }) {
  const s = suggestSplit(income);
  const rows: [string, number, number][] = [
    ["Обязательные", s.essentials, 50],
    ["Повседневные", s.discretionary, 30],
    ["Накопления", s.savings, 20],
  ];
  return (
    <Card title="Шаблон 50/30/20">
      {rows.map(([name, amount, share]) => (
        <div key={name} className="row-block">
          <div className="row">
            <span>{name}</span>
            <b>{formatGel(amount)}</b>
          </div>
          <ProgressBar value={share} label={`${share}%`} />
        </div>
      ))}
    </Card>
  );
}
