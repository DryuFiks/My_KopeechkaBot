import { useEffect, useState } from "react";
import {
  fetchHistoryTransactions,
  TransactionRow,
  type HistoryTransaction,
  type TransactionFilter,
} from "@/entities/history";
import { EditTransaction } from "@/features/edit-transaction";
import { Card, Segmented } from "@/shared/ui";

const SEARCH_DELAY_MS = 300;
const NO_FILTER: TransactionFilter = { q: "", type: "all" };

/**
 * Операции месяца с поиском по категории и комментарию и фильтром «расходы / доходы» (MKB-056).
 * Без фильтра первая страница подгружается кнопкой, чтобы тяжёлый список не мешал открытию месяца;
 * с фильтром — сразу. Тап по операции открывает правку (MKB-053).
 */
export function MonthTransactions({ month, onChanged }: { month: string; onChanged: () => void }) {
  const [filter, setFilter] = useState<TransactionFilter>(NO_FILTER);
  const [items, setItems] = useState<HistoryTransaction[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<HistoryTransaction>();
  const filtered = filter.q.trim() !== "" || filter.type !== "all";

  const load = (offset: number, f: TransactionFilter = filter) => {
    setBusy(true);
    fetchHistoryTransactions(month, offset, f)
      .then((page) => {
        setItems((prev) => (offset === 0 ? page.items : [...prev, ...page.items]));
        setHasMore(page.hasMore);
        setLoaded(true);
        setError(undefined);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setBusy(false));
  };

  // Смена фильтра — новый список с первой страницы; текст ищется с паузой, чтобы не слать запрос на каждую букву.
  useEffect(() => {
    if (!filtered && !loaded) return;
    const t = window.setTimeout(() => load(0, filter), filter.q ? SEARCH_DELAY_MS : 0);
    return () => window.clearTimeout(t);
  }, [filter]);

  return (
    <Card title="Операции">
      <div className="form tx-search">
        <input
          type="search"
          aria-label="Поиск по категории и комментарию"
          placeholder="Поиск: категория или комментарий"
          maxLength={60}
          value={filter.q}
          onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
        />
      </div>
      <Segmented
        label="Тип операций"
        options={[
          { id: "all", label: "Все" },
          { id: "expense", label: "Расходы" },
          { id: "income", label: "Доходы" },
        ]}
        value={filter.type}
        onChange={(type) => setFilter((f) => ({ ...f, type }))}
      />
      {items.map((t) => (
        <TransactionRow key={t.id} t={t} onSelect={setEditing} />
      ))}
      {editing && (
        <EditTransaction
          t={editing}
          onClose={() => setEditing(undefined)}
          onChanged={() => {
            load(0);
            onChanged();
          }}
        />
      )}
      {loaded && items.length === 0 && !hasMore && (
        <p className="hint">{filtered ? "Ничего не нашлось." : "Операций за месяц нет."}</p>
      )}
      {error && (
        <p className="hint" role="alert">
          {error}
        </p>
      )}
      {hasMore && (
        <button className="chip" disabled={busy} onClick={() => load(items.length)}>
          {items.length === 0 ? "Показать операции" : "Показать ещё"}
        </button>
      )}
    </Card>
  );
}
