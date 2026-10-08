import { fetchBudget, SplitCard } from "@/entities/budget";
import { Card } from "@/shared/ui";
import { formatGel } from "@/shared/lib/money";
import { useAsync } from "@/shared/lib/useAsync";
import { Status } from "@/shared/ui";

export function BudgetPage() {
  const state = useAsync(fetchBudget);
  return (
    <>
      <h1>Бюджет</h1>
      <Status state={state}>
        {(d) => (
          <>
            <SplitCard income={d.incomeGel} />
            <Card title="Лимиты по категориям">
              {d.categories.length === 0 && <p className="hint">Лимитов и трат за месяц пока нет.</p>}
              {d.categories.map((c) => (
                <div key={c.category ?? "none"} className="row">
                  <span>{c.category ?? "Без категории"}</span>
                  <b>
                    {formatGel(c.spentGel)}
                    {c.effectiveLimitGel !== null && ` / ${formatGel(c.effectiveLimitGel)}`}
                  </b>
                </div>
              ))}
            </Card>
          </>
        )}
      </Status>
    </>
  );
}
