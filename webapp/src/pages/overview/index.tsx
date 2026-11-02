import { Status } from "@/shared/ui";
import { useAsync } from "@/shared/lib/useAsync";
import { fetchOverview } from "@/entities/budget";
import { TodayCard, fetchSummary } from "@/entities/plan";
import type { TabId } from "@/widgets/tab-bar";

export function OverviewPage({ go }: { go: (tab: TabId) => void }) {
  const state = useAsync(fetchOverview);
  const summary = useAsync(fetchSummary);
  return (
    <>
      <Status state={state}>
        {({ name }) => (
          <>
            <h1>Привет{name ? `, ${name}` : ""}!</h1>
            <button className="primary wide" onClick={() => go("add-expense")}>
              ➖ Добавить расход
            </button>
            <button className="primary wide" onClick={() => go("add-income")}>
              ➕ Добавить доход
            </button>
            <Status state={summary}>{(s) => <TodayCard s={s} />}</Status>
            <button className="link center" onClick={() => go("history")}>
              🗓 История по месяцам
            </button>
          </>
        )}
      </Status>
    </>
  );
}
