import { useState } from "react";
import { DebtList, closeDebt, deleteDebt, fetchDebts, orderDebts } from "@/entities/debt";
import type { Strategy } from "@/entities/debt";
import { StrategyToggle } from "@/features/debt-strategy";
import { AddDebtForm } from "@/features/add-debt";
import { DebtPayoffPlan } from "@/features/debt-payoff-plan";
import { useAsync } from "@/shared/lib/useAsync";
import { Status } from "@/shared/ui";

/** «Цели → Гасить»: долги, стратегия и план погашения. */
export function Debts() {
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const debts = useAsync(fetchDebts);

  async function remove(id: number) {
    await deleteDebt(id);
    debts.reload();
  }

  async function close(id: number) {
    await closeDebt(id);
    debts.reload();
  }

  return (
    <>
      <StrategyToggle value={strategy} onChange={setStrategy} />
      <Status state={debts}>
        {(list) => <DebtList debts={orderDebts(list, strategy)} onDelete={remove} onClose={close} />}
      </Status>
      {debts.data && <DebtPayoffPlan debts={debts.data} strategy={strategy} />}
      <AddDebtForm onAdded={debts.reload} />
    </>
  );
}
