import { Card, Icon, Status } from "@/shared/ui";
import { useAsync } from "@/shared/lib/useAsync";
import { fetchOverview } from "@/entities/budget";
import { TodayCard, fetchSummary } from "@/entities/plan";
import { TransactionRow, fetchRecentTransactions } from "@/entities/history";
import type { TabId } from "@/widgets/tab-bar";

type Go = (tab: TabId) => void;

function RecentOperations({ go }: { go: Go }) {
  const recent = useAsync(fetchRecentTransactions);
  return (
    <Card>
      <div className="card__head">
        <h2 className="card__title">Последние операции</h2>
        <button className="link" onClick={() => go("budget")}>
          Все
        </button>
      </div>
      <Status state={recent}>
        {({ items }) =>
          items.length === 0 ? (
            <p className="hint">Пока пусто. Нажмите «＋» внизу, чтобы записать первую трату.</p>
          ) : (
            items.map((t) => <TransactionRow key={t.id} t={t} />)
          )
        }
      </Status>
    </Card>
  );
}

/** Главная (MKB-051): сколько можно сегодня, быстрые действия, последние операции. */
export function OverviewPage({ go }: { go: Go }) {
  const state = useAsync(fetchOverview);
  const summary = useAsync(fetchSummary);
  return (
    <Status state={state}>
      {({ name }) => (
        <>
          <h1>Привет{name ? `, ${name}` : ""}!</h1>
          <Status state={summary}>{(s) => <TodayCard s={s} />}</Status>
          <div className="quick-actions">
            <button className="chip chip--soft" onClick={() => go("add-expense")}>
              <Icon name="minus" size={18} /> Расход
            </button>
            <button className="chip chip--soft" onClick={() => go("add-income")}>
              <Icon name="plus" size={18} /> Доход
            </button>
          </div>
          <RecentOperations go={go} />
        </>
      )}
    </Status>
  );
}
