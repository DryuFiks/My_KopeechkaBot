import { Card } from "@/shared/ui";
import { formatGel } from "@/shared/lib/money";
import type { Debt } from "../model/types";

export function DebtList({ debts, onDelete }: { debts: Debt[]; onDelete: (id: number) => void }) {
  return (
    <Card title="Порядок погашения">
      {debts.length === 0 && <p className="hint">Долгов нет. Добавь первый ниже.</p>}
      {debts.map((d, i) => (
        <div key={d.id} className="row">
          <span>
            {i + 1}. {d.name} <small>({d.ratePercent}%)</small>
          </span>
          <span>
            <b>{formatGel(d.balanceGel)}</b>{" "}
            <button className="link" aria-label={`Удалить ${d.name}`} onClick={() => onDelete(d.id)}>
              ✕
            </button>
          </span>
        </div>
      ))}
    </Card>
  );
}
