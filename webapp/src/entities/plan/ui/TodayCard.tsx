import { Card } from "@/shared/ui";
import { formatInDisplay } from "@/shared/lib/money";
import type { PlanSummary } from "../model/api";

const STATUS_TEXT = {
  ok: "Всё в порядке — можно спокойно тратить в пределах этой суммы.",
  tight: "Впритык: в этом месяце уже потрачено многое, лучше тратить аккуратнее.",
  over: "Свободных денег на этот месяц не осталось. Не страшно — загляните в расходы и долги.",
} as const;

/** Главное число приложения: сколько можно потратить сегодня и в чём оно складывается. */
export function TodayCard({ s }: { s: PlanSummary }) {
  const fmt = (gel: number) => formatInDisplay(gel, s.displayCurrency, s.displayRateGel);
  const empty = s.incomeGel <= 0;
  return (
    <Card title="Сегодня можно потратить">
      {empty ? (
        <p className="hint">Добавьте доходы и обязательные расходы — и здесь появится сумма на каждый день.</p>
      ) : (
        <>
          <p className={`bignum bignum--${s.today.status}`}>{fmt(s.today.perDayGel)}</p>
          <p className="hint">{STATUS_TEXT[s.today.status]}</p>
          <div className="row">
            <span>Доход в месяц</span>
            <b>{fmt(s.incomeGel)}</b>
          </div>
          <div className="row">
            <span>Обязательные расходы</span>
            <b>{fmt(s.mandatoryGel)}</b>
          </div>
          <div className="row">
            <span>Свободно в месяц</span>
            <b>{fmt(s.freeMonthGel)}</b>
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
