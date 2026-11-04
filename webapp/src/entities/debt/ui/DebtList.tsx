import { Card, EmptyState, Icon } from "@/shared/ui";
import { formatGel } from "@/shared/lib/money";
import type { Debt } from "../model/types";

export function DebtList({ debts, onDelete }: { debts: Debt[]; onDelete: (id: number) => void }) {
  return (
    <Card title="Порядок погашения">
      {debts.length === 0 && <EmptyState icon="card" text="Долгов нет. Если появятся — добавьте их ниже." />}
      {debts.map((d, i) => (
        <div key={d.id} className="row">
          <span>
            {i + 1}. {d.name} <small>({d.ratePercent}%)</small>
          </span>
          <span>
            <b>{formatGel(d.balanceGel)}</b>{" "}
            <button className="link" aria-label={`Удалить ${d.name}`} onClick={() => onDelete(d.id)}>
              <Icon name="close" size={18} />
            </button>
          </span>
        </div>
      ))}
    </Card>
  );
}
