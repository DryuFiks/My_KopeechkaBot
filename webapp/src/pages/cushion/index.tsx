import { fetchCushion } from "@/entities/budget";
import { EmergencyFundCalc } from "@/features/emergency-fund-calc";
import { useAsync } from "@/shared/lib/useAsync";
import { Status } from "@/shared/ui";

export function CushionPage() {
  const state = useAsync(fetchCushion);
  return (
    <>
      <h1>Подушка</h1>
      <Status state={state}>
        {(d) => <EmergencyFundCalc monthlyExpenses={d.avgMonthlyExpensesGel} savings={d.savingsGel} />}
      </Status>
      <p className="hint">Накопления — сумма твоих целей. Расходы — среднее за последние 90 дней.</p>
    </>
  );
}
