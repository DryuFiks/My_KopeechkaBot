import { Card } from "@/shared/ui";
import { formatGel } from "@/shared/lib/money";
import type { Debt } from "../model/types";

export function DebtList({ debts }: { debts: Debt[] }) {
  return (
    <Card title="Порядок погашения">
      {debts.map((d, i) => (
        <div key={d.id} className="row">
          <span>
            {i + 1}. {d.name} <small>({d.ratePercent}%)</small>
          </span>
          <b>{formatGel(d.balanceGel)}</b>
        </div>
      ))}
    </Card>
  );
}
