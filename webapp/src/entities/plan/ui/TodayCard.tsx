import { Card, PlanFactBar } from "@/shared/ui";
import { formatInDisplay } from "@/shared/lib/money";
import type { PlanSummary } from "../model/api";

const STATUS_TEXT = {
  ok: "Всё в порядке — можно спокойно тратить в пределах этой суммы.",
  tight: "Впритык: в этом месяце уже потрачено многое, лучше тратить аккуратнее.",
  over: "Свободных денег на этот месяц не осталось. Не страшно — загляните в расходы и долги.",
} as const;

/**
 * Главная карточка: сколько можно потратить сегодня (от фактических денег: остаток + полученный доход)
 * и план против факта на одной шкале.
 */
export function TodayCard({ s }: { s: PlanSummary }) {
  const fmt = (gel: number) => formatInDisplay(gel, s.displayCurrency, s.displayRateGel);
  const noPlan = s.incomeGel <= 0 && s.mandatoryGel <= 0;
  const noMoney = s.factIncomeGel <= 0 && s.carryOverGel <= 0;
  const empty = noPlan && noMoney && s.expenseGel <= 0;
  return (
    <Card title="Сегодня можно потратить">
      {empty ? (
        <p className="hint">Добавьте доходы и обязательные расходы — и здесь появится сумма на каждый день.</p>
      ) : (
        <>
          <p className={`bignum bignum--${s.today.status}`}>{fmt(s.today.perDayGel)}</p>
          <p className="hint">
            {noMoney
              ? "Доход в этом месяце ещё не поступил. Добавьте его кнопкой «Добавить доход» — тогда появится сумма на день."
              : STATUS_TEXT[s.today.status]}
          </p>
          <PlanFactBar
            title="Доход"
            plan={s.incomeGel}
            fact={s.factIncomeGel}
            planText={fmt(s.incomeGel)}
            factText={fmt(s.factIncomeGel)}
          />
          <PlanFactBar
            title="Расходы"
            plan={s.mandatoryGel}
            fact={s.expenseGel}
            planText={fmt(s.mandatoryGel)}
            factText={fmt(s.expenseGel)}
            over={s.expenseGel > s.mandatoryGel}
          />
          <div className="row">
            <span>Остаток с прошлых месяцев</span>
            <b>{fmt(s.carryOverGel)}</b>
          </div>
          <div className="row">
            <span>Всего на руках</span>
            <b className={s.balanceGel < 0 ? "bad" : undefined}>{fmt(s.balanceGel)}</b>
          </div>
          <div className="row">
            <small>Осталось дней в месяце</small>
            <small>{s.daysLeft}</small>
          </div>
        </>
      )}
      {s.ratesMissing && <p className="hint">Курс одной из валют недоступен — она не учтена в расчёте.</p>}
    </Card>
  );
}
