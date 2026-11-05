import { PlanFactBar } from "@/shared/ui";
import { formatInDisplay } from "@/shared/lib/money";
import type { PlanSummary } from "../model/api";

const STATUS_TEXT = {
  ok: "Всё в порядке — можно спокойно тратить в пределах этой суммы.",
  tight: "Впритык: в этом месяце уже потрачено многое, лучше тратить аккуратнее.",
  over: "Свободных денег на этот месяц не осталось. Не страшно — загляните в расходы и долги.",
} as const;

const RING = 2 * Math.PI * 15.9;

/** Кольцо: какая часть сегодняшней суммы уже потрачена. */
function DayRing({ share, over }: { share: number; over: boolean }) {
  return (
    <svg className={`day-ring${over ? " day-ring--over" : ""}`} viewBox="0 0 36 36" aria-hidden="true">
      <circle className="day-ring__track" cx="18" cy="18" r="15.9" />
      <circle
        className="day-ring__fill"
        cx="18"
        cy="18"
        r="15.9"
        strokeDasharray={`${share * RING} ${RING}`}
        transform="rotate(-90 18 18)"
      />
      <text x="18" y="20.5" textAnchor="middle">
        {Math.round(share * 100)}%
      </text>
    </svg>
  );
}

/**
 * Главная карточка (MKB-051): сколько ещё можно потратить сегодня. Дневная сумма фиксируется
 * в начале дня, сегодняшние траты вычитаются из неё; кольцо — какая часть уже потрачена.
 * Детали месяца (план и факт) свёрнуты под «Подробнее».
 */
export function TodayCard({ s }: { s: PlanSummary }) {
  const fmt = (gel: number) => formatInDisplay(gel, s.displayCurrency, s.displayRateGel);
  const noPlan = s.incomeGel <= 0 && s.mandatoryGel <= 0;
  const noMoney = s.factIncomeGel <= 0 && s.carryOverGel <= 0;
  const empty = noPlan && noMoney && s.expenseGel <= 0;
  const { day } = s;
  const overToday = day.leftGel < 0;
  const tone = overToday ? "over" : s.today.status;

  return (
    <section className="card hero" aria-label="Сегодня можно потратить">
      {empty ? (
        <>
          <h2 className="card__title">Сегодня можно потратить</h2>
          <p className="hint">Добавьте доходы и обязательные расходы — и здесь появится сумма на каждый день.</p>
        </>
      ) : (
        <>
          <div className="hero__top">
            <div>
              <h2 className="card__title">Сегодня можно потратить</h2>
              <p className={`bignum bignum--${tone}`}>{fmt(Math.max(0, day.leftGel))}</p>
              <p className="hint hero__sub">
                {overToday
                  ? `Сверх дневной суммы на ${fmt(-day.leftGel)}`
                  : day.spentGel > 0
                    ? `Потрачено ${fmt(day.spentGel)} из ${fmt(day.allowanceGel)}`
                    : `На день: ${fmt(day.allowanceGel)}`}
              </p>
            </div>
            <DayRing share={day.share} over={overToday} />
          </div>
          <p className="hint">
            {noMoney
              ? "Доход в этом месяце ещё не поступил. Добавьте его — тогда появится сумма на день."
              : STATUS_TEXT[s.today.status]}
          </p>
          <details className="more">
            <summary>Подробнее о месяце</summary>
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
          </details>
        </>
      )}
      {s.ratesMissing && <p className="hint">Курс одной из валют недоступен — она не учтена в расчёте.</p>}
    </section>
  );
}
