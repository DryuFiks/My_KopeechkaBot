import { Card, PlanFactBar } from "@/shared/ui";
import { formatGel } from "@/shared/lib/money";
import { splitAfterMandatory } from "../lib/split";

/**
 * Куда пойдут деньги месяца: обязательные платежи, затем повседневные траты и накопления.
 * `income` — фактический доход месяца, а пока он не пришёл — плановый.
 */
export function SplitCard({
  income,
  mandatory,
  expense,
  planned,
}: {
  income: number;
  mandatory: number;
  expense: number;
  planned: boolean;
}) {
  const s = splitAfterMandatory(income, mandatory, expense);
  return (
    <Card title="Куда пойдут деньги">
      {planned && <p className="hint">Доход этого месяца ещё не поступил — считаем от планового.</p>}
      <PlanFactBar
        title="Обязательные"
        plan={s.essentials}
        fact={s.essentialsSpent}
        planText={formatGel(s.essentials)}
        factText={formatGel(s.essentialsSpent)}
      />
      <PlanFactBar
        title="Повседневные"
        plan={s.discretionary}
        fact={s.discretionarySpent}
        planText={formatGel(s.discretionary)}
        factText={formatGel(s.discretionarySpent)}
        over={s.discretionarySpent > s.discretionary}
      />
      <div className="row">
        <span>Накопления</span>
        <b>{formatGel(s.savings)}</b>
      </div>
      <p className="hint">Остаток сверх обязательных делится 60% на повседневные и 40% на накопления.</p>
    </Card>
  );
}
