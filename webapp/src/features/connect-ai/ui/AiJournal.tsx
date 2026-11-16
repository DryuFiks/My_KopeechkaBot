import { TransactionRow } from "@/entities/history/ui/TransactionRow";
import { undoTransaction } from "@/entities/transaction";
import type { McpOverview } from "@/entities/mcp";
import { formatGel, formatMoney } from "@/shared/lib/money";
import { useAction } from "@/shared/lib/useAction";

/** Что внесли агенты (с кнопкой «Удалить») и как остаток в банке соотносится с расчётным. */
export function AiJournal({ data, onChanged }: { data: McpOverview; onChanged: () => void }) {
  const remove = useAction(onChanged);
  const r = data.reconciliation;
  return (
    <>
      <h3>Остаток на счетах</h3>
      {r === null ? (
        <p className="hint">Агент ещё не присылал остаток. Попросите: «сверь остаток на карте».</p>
      ) : (
        <>
          {data.balances.map((b) => (
            <div className="row" key={b.account}>
              <span>
                {b.account}
                <small> · {new Date(b.asOf).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</small>
              </span>
              <b>{formatMoney(b.amount, b.currency)}</b>
            </div>
          ))}
          <p className="hint" role="status">
            {r.matches
              ? "Остаток в банке совпадает с расчётным балансом бота."
              : `В банке ${formatGel(r.bankTotalGel)}, в боте ${formatGel(r.calculatedGel)}: разница ${formatGel(r.differenceGel)}. Сразу после подключения это начальный остаток, позже — пропущенные или лишние операции.`}
            {r.notConverted.length > 0 && ` Без курса не учтены: ${r.notConverted.join(", ")}.`}
          </p>
        </>
      )}

      <h3>Внесено агентами</h3>
      {data.journal.length === 0 ? (
        <p className="hint">Пока ничего. Операции, добавленные через MCP, появятся здесь.</p>
      ) : (
        data.journal.map((t) => (
          <div className="row" key={t.id}>
            <TransactionRow t={{ ...t, amountGel: null }} />
            <button
              className="chip chip--danger"
              disabled={remove.busy}
              aria-label={`Удалить операцию ${t.note ?? t.category ?? t.id}`}
              onClick={() => void remove.run(() => undoTransaction(t.id))}
            >
              Удалить
            </button>
          </div>
        ))
      )}
      {remove.error && (
        <p className="hint" role="alert">
          {remove.error}
        </p>
      )}
    </>
  );
}
