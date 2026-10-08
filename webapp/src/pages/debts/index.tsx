import { useState } from "react";
import { DebtList, deleteDebt, fetchDebts, orderDebts } from "@/entities/debt";
import type { Strategy } from "@/entities/debt";
import { StrategyToggle } from "@/features/debt-strategy";
import { AddDebtForm } from "@/features/add-debt";
import { useAsync } from "@/shared/lib/useAsync";
import { Status } from "@/shared/ui";

export function DebtsPage() {
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const debts = useAsync(fetchDebts);

  async function remove(id: number) {
    await deleteDebt(id);
    debts.reload();
  }

  return (
    <>
      <h1>Долги</h1>
      <StrategyToggle value={strategy} onChange={setStrategy} />
      <Status state={debts}>{(list) => <DebtList debts={orderDebts(list, strategy)} onDelete={remove} />}</Status>
      <AddDebtForm onAdded={debts.reload} />
    </>
  );
}
