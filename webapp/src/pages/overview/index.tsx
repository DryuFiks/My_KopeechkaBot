import { Card, ProgressBar } from "@/shared/ui";
import { formatGel, percent } from "@/shared/lib/money";
import { getUserName } from "@/shared/lib/telegram";
import { MOCK_MONTH } from "@/entities/budget";

export function OverviewPage() {
  const { incomeGel, spentGel } = MOCK_MONTH;
  return (
    <>
      <h1>Привет, {getUserName()}!</h1>
      <Card title="Этот месяц">
        <div className="row">
          <span>Доход</span>
          <b>{formatGel(incomeGel)}</b>
        </div>
        <div className="row">
          <span>Расходы</span>
          <b>{formatGel(spentGel)}</b>
        </div>
        <div className="row">
          <span>Остаток</span>
          <b>{formatGel(incomeGel - spentGel)}</b>
        </div>
        <ProgressBar value={percent(spentGel, incomeGel)} label={`${percent(spentGel, incomeGel)}% дохода потрачено`} />
      </Card>
      <p className="hint">Данные-заглушки. Реальные подтянутся из бота на этапе 2.</p>
    </>
  );
}
