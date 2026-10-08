import { useState } from "react";
import { applyBudget } from "@/entities/plan";
import type { CategoryLimit, PlanSummary } from "@/entities/plan";
import { Hint } from "@/shared/ui";
import { formatGel } from "@/shared/lib/money";
import { parseAmount, useAction } from "@/shared/lib/useAction";

/** Шаг 7: лимиты на повседневные траты — стартовая точка, которую можно править. */
export function BudgetTemplatesStep({ summary }: { summary: PlanSummary }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(summary.categoryLimits.map((l) => [l.category, String(l.limitGel)])),
  );
  const [applied, setApplied] = useState(false);
  const { error, busy, run } = useAction();

  if (summary.categoryLimits.length === 0) {
    return (
      <Hint>
        Свободных денег на месяц пока нет, поэтому лимиты предложить нечем. Их можно задать позже на вкладке «Бюджет».
      </Hint>
    );
  }

  async function apply() {
    const limits: CategoryLimit[] = summary.categoryLimits
      .map((l) => ({ category: l.category, limitGel: parseAmount(values[l.category] ?? "") }))
      .filter((l) => l.limitGel > 0);
    if (await run(() => applyBudget(limits))) setApplied(true);
  }

  return (
    <>
      <Hint example="свободно 1600 ₾: 20% откладываем, на остальное — по категориям (еда, транспорт…)">
        Это лишь отправная точка, не правило. Поправьте суммы под себя и нажмите «Применить» — лимиты появятся во
        вкладке «Бюджет» на этот месяц.
      </Hint>
      {summary.categoryLimits.map((l) => (
        <div key={l.category} className="row">
          <label htmlFor={`limit-${l.category}`}>{l.category}</label>
          <input
            id={`limit-${l.category}`}
            className="inline-input"
            inputMode="decimal"
            value={values[l.category] ?? ""}
            onChange={(e) => {
              setApplied(false);
              setValues({ ...values, [l.category]: e.target.value });
            }}
          />
        </div>
      ))}
      <button className="primary" onClick={apply} disabled={busy}>
        {applied ? "Применено ✓ (можно изменить и применить снова)" : "Применить лимиты"}
      </button>
      <p className="hint">Суммы указаны в лари. Всего: {formatGel(Object.values(values).reduce((s, v) => s + (parseAmount(v) || 0), 0))}</p>
      {error && (
        <p className="hint" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
