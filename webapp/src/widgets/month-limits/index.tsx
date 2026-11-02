import { fetchBudget, SplitCard } from "@/entities/budget";
import type { BudgetCategory } from "@/entities/budget";
import { AddLimitForm, LimitControls } from "@/features/edit-budget-limit";
import { fetchSummary } from "@/entities/plan";
import { DeleteCategory } from "@/features/delete-category";
import { Card, ProgressBar, Status } from "@/shared/ui";
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

/** Лимиты текущего месяца внутри вкладки «Бюджет»: прогноз, деление дохода, лимиты по категориям. */
export function MonthLimits({ onChanged }: { onChanged: () => void }) {
  const state = useAsync(fetchBudget);
  const summary = useAsync(fetchSummary);
  const reload = () => {
    state.reload();
    onChanged();
  };
  return (
    <Status state={state}>
      {(d) => (
        <>
          {d.projectedExpenseGel !== null && (
            <Card title="Прогноз">
              <div className="row">
                <span>К концу месяца</span>
                <b>{formatGel(d.projectedExpenseGel)}</b>
              </div>
              {d.incomeGel > 0 && d.projectedExpenseGel > d.incomeGel && (
                <p className="hint">При таком темпе расходы превысят доход месяца.</p>
              )}
            </Card>
          )}
          <Status state={summary}>
            {(s) => (
              <SplitCard
                income={s.factIncomeGel > 0 ? s.factIncomeGel : s.incomeGel}
                planned={s.factIncomeGel <= 0}
                mandatory={s.mandatoryGel}
                expense={s.expenseGel}
              />
            )}
          </Status>
          <Card title="Лимиты по категориям">
            {d.categories.length === 0 && <p className="hint">Лимитов и трат за месяц пока нет.</p>}
            {d.categories.map((c) => (
              <CategoryRow key={c.category ?? "none"} c={c} onChanged={reload} />
            ))}
          </Card>
          <AddLimitForm known={d.categories.flatMap((c) => (c.category ? [c.category] : []))} onAdded={reload} />
        </>
      )}
    </Status>
  );
}
