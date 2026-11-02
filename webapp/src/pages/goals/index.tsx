import { fetchCushion } from "@/entities/budget";
import { fetchGoals, GoalCard } from "@/entities/goal";
import { EmergencyFundCalc } from "@/features/emergency-fund-calc";
import { ContributeForm } from "@/features/contribute-goal";
import { AddGoalForm } from "@/features/add-goal";
import { DeleteGoal } from "@/features/delete-goal";
import { formatGel } from "@/shared/lib/money";
import { useAsync } from "@/shared/lib/useAsync";
import { Status } from "@/shared/ui";

export function GoalsPage() {
  const state = useAsync(fetchGoals);
  const cushion = useAsync(fetchCushion);
  return (
    <>
      <h1>Цели и подушка</h1>
      <Status state={cushion}>
        {(c) => <EmergencyFundCalc monthlyExpenses={c.avgMonthlyExpensesGel} savings={c.savingsGel} />}
      </Status>
      <p className="hint">Накопления — сумма твоих целей. Расходы — среднее за последние 90 дней.</p>
      <Status state={state}>
        {(d) => (
          <>
            <p className="hint">
              Свободные деньги в месяц (среднее за 90 дней): <b>{formatGel(d.monthlySavingsGel)}</b>. Прогноз
              для каждой цели считается так, будто все они идут на неё одну.
            </p>
            {d.goals.length === 0 && <p className="hint">Целей пока нет. Создай первую ниже.</p>}
            {d.goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                actions={
                  <>
                    <ContributeForm goalId={g.id} onDone={state.reload} />
                    <DeleteGoal goalId={g.id} onDone={state.reload} />
                  </>
                }
              />
            ))}
          </>
        )}
      </Status>
      <AddGoalForm onAdded={state.reload} />
    </>
  );
}
