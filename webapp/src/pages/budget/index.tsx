import { MOCK_MONTH, SplitCard } from "@/entities/budget";

export function BudgetPage() {
  return (
    <>
      <h1>Бюджет</h1>
      <SplitCard income={MOCK_MONTH.incomeGel} />
    </>
  );
}
