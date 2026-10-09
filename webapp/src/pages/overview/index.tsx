import { Card, ProgressBar, Status } from "@/shared/ui";
import { formatGel, percent } from "@/shared/lib/money";
import { useAsync } from "@/shared/lib/useAsync";
import { fetchOverview } from "@/entities/budget";
import { TodayCard, fetchSummary } from "@/entities/plan";
import { RankCard, fetchProgress } from "@/entities/progress";
import type { TabId } from "@/widgets/tab-bar";

export function OverviewPage({ go }: { go: (tab: TabId) => void }) {
  const state = useAsync(fetchOverview);
  const summary = useAsync(fetchSummary);
  const progress = useAsync(fetchProgress);
  return (
    <>
      <Status state={state}>
        {({ name, incomeGel, expenseGel }) => (
          <>
            <h1>Привет{name ? `, ${name}` : ""}!</h1>
            <button className="primary wide" onClick={() => go("add-expense")}>
              ➖ Добавить расход
            </button>
            <Status state={summary}>{(s) => <TodayCard s={s} />}</Status>
            <Status state={progress}>{(p) => <RankCard p={p} onOpen={() => go("awards")} />}</Status>
            <Card title="Этот месяц">
              <div className="row">
                <span>Доход</span>
                <b>{formatGel(incomeGel)}</b>
              </div>
              <div className="row">
                <span>Расходы</span>
                <b>{formatGel(expenseGel)}</b>
              </div>
              <div className="row">
                <span>Остаток</span>
                <b>{formatGel(incomeGel - expenseGel)}</b>
              </div>
              <ProgressBar
                value={percent(expenseGel, incomeGel)}
                label={`${percent(expenseGel, incomeGel)}% дохода потрачено`}
              />
            </Card>
            <button className="link center" onClick={() => go("settings")}>
              ⚙️ Настройки
            </button>
          </>
        )}
      </Status>
    </>
  );
}
