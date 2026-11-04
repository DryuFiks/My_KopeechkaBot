import { useState } from "react";
import {
  fetchHistory,
  fetchHistoryMonth,
  fetchHistoryTransactions,
  pickMonth,
  TransactionRow,
  type HistoryMonth,
  type HistoryTransaction,
} from "@/entities/history";
import { BarChart, Card, DonutChart, donutColor, Status } from "@/shared/ui";
import { monthLabel } from "@/shared/lib/date";
import { formatGel, percent } from "@/shared/lib/money";
import { useAsync } from "@/shared/lib/useAsync";

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

function Delta({ now, before }: { now: number; before: number | undefined }) {
  if (before === undefined) return null;
  const diff = now - before;
  if (Math.abs(diff) < 0.005) return null;
  return (
    <span className={`spend-delta${diff > 0 ? " bad" : ""}`} title="К прошлому месяцу">
      {diff > 0 ? "↑" : "↓"} {formatGel(Math.abs(diff))}
    </span>
  );
}

function MonthView({ month, previous }: { month: string; previous?: HistoryMonth }) {
  const state = useAsync(() => fetchHistoryMonth(month));
  const [view, setView] = useState<"donut" | "days">("donut");
  return (
    <Status state={state}>
      {(d) => (
        <>
          <div className="spend-total">
            <b>{formatGel(d.expenseGel)}</b>
            <Delta now={d.expenseGel} before={previous?.expenseGel} />
          </div>
          <p className="hint">Траты</p>
          {d.expenseGel > 0 && (
            <div className="segmented" role="group" aria-label="Вид диаграммы">
              <button className={view === "donut" ? "is-active" : ""} onClick={() => setView("donut")}>
                Категории
              </button>
              <button className={view === "days" ? "is-active" : ""} onClick={() => setView("days")}>
                По дням
              </button>
            </div>
          )}
          {d.expenseGel > 0 && view === "donut" && (
            <DonutChart
              values={d.categories.map((c) => c.amountGel)}
              label={`Расходы по категориям: ${monthLabel(month)}`}
              caption={monthLabel(month).split(" ")[0]}
            />
          )}
          {d.expenseGel > 0 && view === "days" && (
            <BarChart
              values={d.daily}
              total={d.daysInMonth}
              label={`Расходы по дням: ${monthLabel(month)}`}
            />
          )}
          <Card title="Категории">
            {d.categories.length === 0 && <p className="hint">Расходов за месяц нет.</p>}
            {d.categories.map((c, i) => (
              <div key={c.category ?? "none"} className="row">
                <span>
                  <span className="cat-dot" style={{ background: donutColor(i) }} />
                  {c.category ?? "Без категории"} <small>{percent(c.amountGel, d.expenseGel)}%</small>
                </span>
                <b>{formatGel(c.amountGel)}</b>
              </div>
            ))}
          </Card>
          <Card title="Итоги месяца">
            <div className="month-summary">
              <span>Остаток с прошлых</span>
              <b>{formatGel(d.openingGel)}</b>
              <span>Доход</span>
              <b>{formatGel(d.incomeGel)}</b>
              <span>Остаток на конец</span>
              <b className={d.closingGel < 0 ? "bad" : undefined}>{formatGel(d.closingGel)}</b>
            </div>
          </Card>
          <Transactions month={month} />
        </>
      )}
    </Status>
  );
}

/** «Бюджет → Траты»: месяцы чипами, траты кольцом или по дням, категории и операции. */
export function MonthHistory() {
  const state = useAsync(fetchHistory);
  const [picked, setPicked] = useState<string>();
  return (
    <>
      <Status state={state}>
        {({ months }) => {
          const { selected, previous } = pickMonth(months, picked);
          if (!selected) return <p className="hint">Операций пока нет.</p>;
          return (
            <>
              <div className="month-chips" role="group" aria-label="Месяц">
                {months.map((m) => (
                  <button
                    key={m.month}
                    className={`chip${m.month === selected.month ? " is-active" : ""}`}
                    onClick={() => setPicked(m.month)}
                  >
                    {monthLabel(m.month)}
                  </button>
                ))}
              </div>
              <MonthView key={selected.month} month={selected.month} previous={previous} />
            </>
          );
        }}
      </Status>
    </>
  );
}
