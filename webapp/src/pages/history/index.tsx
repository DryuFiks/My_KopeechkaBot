import { useState } from "react";
import {
  fetchHistory,
  fetchHistoryMonth,
  fetchHistoryTransactions,
  type HistoryMonth,
  type HistoryTransaction,
} from "@/entities/history";
import { BarChart, Card, ProgressBar, Status } from "@/shared/ui";
import { monthLabel } from "@/shared/lib/date";
import { formatGel, formatMoney, percent } from "@/shared/lib/money";
import { useAsync } from "@/shared/lib/useAsync";

function TransactionRow({ t }: { t: HistoryTransaction }) {
  const sign = t.type === "income" ? "+" : "−";
  const day = new Date(t.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return (
    <div className="row">
      <span>
        {t.category ?? "Без категории"}
        <small> · {day}</small>
        {t.note && <small> · {t.note}</small>}
      </span>
      <b>
        {sign}
        {formatMoney(t.amount, t.currency)}
      </b>
    </div>
  );
}

function Transactions({ month }: { month: string }) {
  const [items, setItems] = useState<HistoryTransaction[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const loadMore = () => {
    setBusy(true);
    fetchHistoryTransactions(month, items.length)
      .then((page) => {
        setItems((prev) => [...prev, ...page.items]);
        setHasMore(page.hasMore);
        setError(undefined);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setBusy(false));
  };

  // Первая страница подгружается кнопкой, чтобы тяжёлый список не мешал открытию месяца.
  return (
    <Card title="Операции">
      {items.map((t) => (
        <TransactionRow key={t.id} t={t} />
      ))}
      {items.length === 0 && !hasMore && <p className="hint">Операций за месяц нет.</p>}
      {error && (
        <p className="hint" role="alert">
          {error}
        </p>
      )}
      {hasMore && (
        <button className="chip" disabled={busy} onClick={loadMore}>
          {items.length === 0 ? "Показать операции" : "Показать ещё"}
        </button>
      )}
    </Card>
  );
}

function MonthDetail({ month, onBack }: { month: string; onBack: () => void }) {
  const state = useAsync(() => fetchHistoryMonth(month));
  return (
    <>
      <button className="link" onClick={onBack}>
        ‹ Все месяцы
      </button>
      <h1>{monthLabel(month)}</h1>
      <Status state={state}>
        {(d) => (
          <>
            <Card title="Итоги месяца">
              <div className="row">
                <span>Остаток с прошлых месяцев</span>
                <b>{formatGel(d.openingGel)}</b>
              </div>
              <div className="row">
                <span>Доход</span>
                <b>{formatGel(d.incomeGel)}</b>
              </div>
              <div className="row">
                <span>Расходы</span>
                <b>{formatGel(d.expenseGel)}</b>
              </div>
              <div className="row">
                <span>Остаток на конец месяца</span>
                <b className={d.closingGel < 0 ? "bad" : undefined}>{formatGel(d.closingGel)}</b>
              </div>
            </Card>
            <Card title="Расходы по дням">
              {d.daily.length > 0 ? (
                <BarChart values={d.daily} total={d.daysInMonth} label={`Расходы по дням: ${monthLabel(month)}`} />
              ) : (
                <p className="hint">Расходов за месяц нет.</p>
              )}
            </Card>
            <Card title="Расходы по категориям">
              {d.categories.length === 0 && <p className="hint">Расходов за месяц нет.</p>}
              {d.categories.map((c) => (
                <div key={c.category ?? "none"} className="row-block">
                  <div className="row">
                    <span>{c.category ?? "Без категории"}</span>
                    <b>{formatGel(c.amountGel)}</b>
                  </div>
                  <ProgressBar value={percent(c.amountGel, d.expenseGel)} />
                </div>
              ))}
            </Card>
            <Transactions month={month} />
          </>
        )}
      </Status>
    </>
  );
}

function MonthButton({ m, onOpen }: { m: HistoryMonth; onOpen: () => void }) {
  return (
    <button className="history-month" onClick={onOpen}>
      <span className="row">
        <b>{monthLabel(m.month)}</b>
        <b className={m.closingGel < 0 ? "bad" : undefined}>{formatGel(m.closingGel)}</b>
      </span>
      <span className="row">
        <small>
          Доход {formatGel(m.incomeGel)} · Расходы {formatGel(m.expenseGel)}
        </small>
        <small>{m.operations} оп.</small>
      </span>
    </button>
  );
}

/** История по месяцам: итоги, остаток, категории и полный список операций любого прошлого месяца. */
export function HistoryPage() {
  const state = useAsync(fetchHistory);
  const [month, setMonth] = useState<string | null>(null);
  if (month) return <MonthDetail key={month} month={month} onBack={() => setMonth(null)} />;
  return (
    <>
      <h1>История</h1>
      <Status state={state}>
        {({ months }) => (
          <>
            <p className="hint">Остаток переходит из месяца в месяц и копится с первой записанной операции.</p>
            {months.map((m) => (
              <MonthButton key={m.month} m={m} onOpen={() => setMonth(m.month)} />
            ))}
          </>
        )}
      </Status>
    </>
  );
}
