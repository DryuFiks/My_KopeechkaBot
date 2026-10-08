import { fetchBudget, SplitCard } from "@/entities/budget";
import type { BudgetCategory } from "@/entities/budget";
import { AddLimitForm, LimitControls } from "@/features/edit-budget-limit";
import { DeleteCategory } from "@/features/delete-category";
import { BarChart, Card, ProgressBar, Status } from "@/shared/ui";
import { formatGel, percent } from "@/shared/lib/money";
import { useAsync } from "@/shared/lib/useAsync";

function CategoryRow({ c, onChanged }: { c: BudgetCategory; onChanged: () => void }) {
  const limit = c.effectiveLimitGel;
  const over = limit !== null && c.spentGel > limit;
  return (
    <div className="row-block row-block--deletable">
      <div className="row">
        <span>{c.category ?? "Без категории"}</span>
        <b className={over ? "bad" : undefined}>
          {formatGel(c.spentGel)}
          {limit !== null && ` / ${formatGel(limit)}`}
        </b>
      </div>
      {limit !== null && <ProgressBar value={percent(c.spentGel, limit)} label={over ? "лимит превышен" : undefined} />}
      {c.category !== null && <LimitControls row={{ ...c, category: c.category }} onChanged={onChanged} />}
      {c.category !== null && <DeleteCategory category={c.category} onDone={onChanged} />}
    </div>
  );
}

export function BudgetPage() {
  const state = useAsync(fetchBudget);
  return (
    <>
      <h1>Бюджет</h1>
      <Status state={state}>
        {(d) => (
          <>
            <Card title="Расходы по дням">
              <BarChart values={d.daily} total={d.daysInMonth} label="Расходы по дням текущего месяца" />
              <div className="row">
                <span>Потрачено за месяц</span>
                <b>{formatGel(d.expenseGel)}</b>
              </div>
              {d.projectedExpenseGel !== null && (
                <div className="row">
                  <span>Прогноз к концу месяца</span>
                  <b>{formatGel(d.projectedExpenseGel)}</b>
                </div>
              )}
              {d.projectedExpenseGel !== null && d.incomeGel > 0 && d.projectedExpenseGel > d.incomeGel && (
                <p className="hint">При таком темпе расходы превысят доход месяца.</p>
              )}
            </Card>
            <SplitCard income={d.incomeGel} />
            <Card title="Лимиты по категориям">
              {d.categories.length === 0 && <p className="hint">Лимитов и трат за месяц пока нет.</p>}
              {d.categories.map((c) => (
                <CategoryRow key={c.category ?? "none"} c={c} onChanged={state.reload} />
              ))}
            </Card>
            <AddLimitForm
              known={d.categories.flatMap((c) => (c.category ? [c.category] : []))}
              onAdded={state.reload}
            />
          </>
        )}
      </Status>
    </>
  );
}
