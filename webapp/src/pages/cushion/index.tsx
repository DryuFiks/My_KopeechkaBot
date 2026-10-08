import { MOCK_MONTH } from "@/entities/budget";
import { EmergencyFundCalc } from "@/features/emergency-fund-calc";

export function CushionPage() {
  return (
    <>
      <h1>Подушка</h1>
      <EmergencyFundCalc monthlyExpenses={MOCK_MONTH.avgMonthlyExpensesGel} savings={MOCK_MONTH.savingsGel} />
    </>
  );
}
