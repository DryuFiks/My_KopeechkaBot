import { useState } from "react";
import { DebtList, MOCK_DEBTS, orderDebts } from "@/entities/debt";
import type { Strategy } from "@/entities/debt";
import { StrategyToggle } from "@/features/debt-strategy";

export function DebtsPage() {
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  return (
    <>
      <h1>Долги</h1>
      <StrategyToggle value={strategy} onChange={setStrategy} />
      <DebtList debts={orderDebts(MOCK_DEBTS, strategy)} />
    </>
  );
}
