import { useState } from "react";
import { Card, EmptyState, Icon, Status } from "@/shared/ui";
import { useAsync } from "@/shared/lib/useAsync";
import { fetchOverview } from "@/entities/budget";
import { TodayCard, fetchSummary } from "@/entities/plan";
import { TransactionRow, fetchRecentTransactions, type HistoryTransaction } from "@/entities/history";
import { fetchCategoryOptions } from "@/entities/transaction";
import { fetchPayments, upcoming, whenLabel } from "@/entities/payment";
import { formatMoney } from "@/shared/lib/money";
import { EditTransaction } from "@/features/edit-transaction";
import type { QuickAddPreset } from "@/features/quick-add";
import type { TabId } from "@/widgets/tab-bar";

type Go = (tab: TabId) => void;
type QuickAddFn = (preset?: QuickAddPreset) => void;

const FREQUENT = 3;

/** Частые категории расходов: тап открывает быстрый ввод сразу с категорией (MKB-052). */
function QuickActions({ quickAdd }: { quickAdd: QuickAddFn }) {
  const cats = useAsync(() => fetchCategoryOptions("expense"));
  const frequent = cats.data?.categories.slice(0, FREQUENT) ?? [];
  return (
    <div className="quick-actions" role="group" aria-label="Быстро записать">
      {frequent.map((c) => (
        <button key={c} className="chip chip--soft" onClick={() => quickAdd({ type: "expense", category: c })}>
          {c}
        </button>
      ))}
      <button className="chip chip--soft" onClick={() => quickAdd({ type: "income" })}>
        <Icon name="plus" size={18} /> Доход
      </button>
    </div>
  );
}

/** Ближайшие два регулярных платежа (MKB-059); без платежей карточки нет. */
function UpcomingPayments({ go }: { go: Go }) {
  const state = useAsync(fetchPayments);
  const next = state.data ? upcoming(state.data.items, 2) : [];
  if (next.length === 0) return null;
  return (
    <Card>
      <div className="card__head">
        <h2 className="card__title">Ближайшие платежи</h2>
        <button className="link" onClick={() => go("budget")}>
          Все
        </button>
      </div>
      {next.map((p) => (
        <div key={p.id} className="row">
          <span>
            {p.title}
            <small> · {whenLabel(p.next.inDays)}</small>
          </span>
          <b className="amount">{formatMoney(p.amount, p.currency)}</b>
        </div>
      ))}
    </Card>
  );
}

function RecentOperations({ go, quickAdd, onChanged }: { go: Go; quickAdd: QuickAddFn; onChanged: () => void }) {
  const recent = useAsync(fetchRecentTransactions);
  const [editing, setEditing] = useState<HistoryTransaction>();
  return (
    <Card>
      {editing && (
        <EditTransaction
          t={editing}
          onClose={() => setEditing(undefined)}
          onChanged={() => {
            recent.reload();
            onChanged();
          }}
        />
      )}
      <div className="card__head">
        <h2 className="card__title">Последние операции</h2>
        <button className="link" onClick={() => go("budget")}>
          Все
        </button>
      </div>
      <Status state={recent}>
        {({ items }) =>
          items.length === 0 ? (
            <EmptyState
              icon="plus"
              text="Операций пока нет — запишите первую трату."
              action={{ label: "Записать трату", onClick: () => quickAdd() }}
            />
          ) : (
            items.map((t) => <TransactionRow key={t.id} t={t} onSelect={setEditing} />)
          )
        }
      </Status>
    </Card>
  );
}

/** Главная (MKB-051): сколько можно сегодня, быстрый ввод по частым категориям, последние операции. */
export function OverviewPage({ go, quickAdd }: { go: Go; quickAdd: QuickAddFn }) {
  const state = useAsync(fetchOverview);
  const summary = useAsync(fetchSummary);
  return (
    <Status state={state}>
      {({ name }) => (
        <>
          <h1>Привет{name ? `, ${name}` : ""}!</h1>
          <Status state={summary}>{(s) => <TodayCard s={s} />}</Status>
          <QuickActions quickAdd={quickAdd} />
          <UpcomingPayments go={go} />
          <RecentOperations go={go} quickAdd={quickAdd} onChanged={summary.reload} />
        </>
      )}
    </Status>
  );
}
