import { useState } from "react";
import {
  fetchHistory,
  fetchHistoryMonth,
  fetchHistoryTransactions,
  type HistoryMonth,
  type HistoryTransaction,
} from "@/entities/history";
import { BarChart, Card, DonutChart, donutColor, Status } from "@/shared/ui";
import { monthLabel } from "@/shared/lib/date";
import { formatGel, formatMoney, percent } from "@/shared/lib/money";
import { useAsync } from "@/shared/lib/useAsync";
import { MonthLimits } from "@/widgets/month-limits";

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

function MonthView({ month, previous, current }: { month: string; previous?: HistoryMonth; current: boolean }) {
  const state = useAsync(() => fetchHistoryMonth(month));
  const [view, setView] = useState<"donut" | "days">("donut");
  const [limits, setLimits] = useState(false);
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
            <BarChart values={d.daily} total={d.daysInMonth} label={`Расходы по дням: ${monthLabel(month)}`} />
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
          {current && (
            <>
              <button className="chip chip--soft" onClick={() => setLimits((v) => !v)} aria-expanded={limits}>
                {limits ? "Скрыть лимиты" : "Лимиты и прогноз"}
              </button>
              {limits && <MonthLimits onChanged={state.reload} />}
            </>
          )}
          <Transactions month={month} />
        </>
      )}
    </Status>
  );
}

/** Вкладка «Бюджет»: месяцы чипами, траты кольцом или по дням, категории, лимиты текущего месяца и операции. */
export function HistoryPage() {
  const state = useAsync(fetchHistory);
  const [picked, setPicked] = useState<string>();
  return (
    <>
      <h1>Бюджет</h1>
      <Status state={state}>
        {({ months }) => {
          const found = months.findIndex((m) => m.month === picked);
          const at = found >= 0 ? found : months.length - 1;
          const selected = months[at];
          if (!selected) return <p className="hint">Операций пока нет.</p>;
          return (
            <>
              <div className="month-chips" role="group" aria-label="Месяц">
                {[...months].reverse().map((m) => (
                  <button
                    key={m.month}
                    className={`chip${m.month === selected.month ? " is-active" : ""}`}
                    onClick={() => setPicked(m.month)}
                  >
                    {monthLabel(m.month)}
                  </button>
                ))}
              </div>
              <MonthView
                key={selected.month}
                month={selected.month}
                previous={months[at - 1]}
                current={at === months.length - 1}
              />
            </>
          );
        }}
      </Status>
    </>
  );
}
