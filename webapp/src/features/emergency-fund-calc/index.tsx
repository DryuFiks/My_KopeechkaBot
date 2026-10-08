import { useState } from "react";
import { Card, ProgressBar } from "@/shared/ui";
import { formatGel, percent } from "@/shared/lib/money";

/** Подушка безопасности: сколько месяцев расходов покрывают накопления (цель 3–6). */
export function EmergencyFundCalc({ monthlyExpenses, savings }: { monthlyExpenses: number; savings: number }) {
  const [targetMonths, setTargetMonths] = useState(3);
  const months = monthlyExpenses > 0 ? savings / monthlyExpenses : 0;
  const target = monthlyExpenses * targetMonths;

  return (
    <Card title="Подушка безопасности">
      <div className="row">
        <span>Накоплено</span>
        <b>{formatGel(savings)}</b>
      </div>
      <div className="row">
        <span>Хватит на</span>
        <b>{months.toFixed(1)} мес.</b>
      </div>
      <label className="row">
        <span>Цель, месяцев</span>
        <select value={targetMonths} onChange={(e) => setTargetMonths(Number(e.target.value))}>
          {[3, 4, 5, 6].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <ProgressBar value={percent(savings, target)} label={`${formatGel(savings)} из ${formatGel(target)}`} />
    </Card>
  );
}
