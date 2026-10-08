import { useEffect, useState } from "react";
import { Card, Hint } from "@/shared/ui";
import { formatGel } from "@/shared/lib/money";
import { fetchPlan } from "@/entities/debt";
import type { Debt, PayoffPlan, PlanComparison, Strategy } from "@/entities/debt";

function monthLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

function duration(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} г.` : "", m ? `${m} мес.` : ""].filter(Boolean).join(" ") || "менее месяца";
}

/** Срок погашения и переплата при выбранном месячном бюджете; сравнение со второй стратегией. */
export function DebtPayoffPlan({ debts, strategy }: { debts: Debt[]; strategy: Strategy }) {
  const [budget, setBudget] = useState("");
  const [plan, setPlan] = useState<PlanComparison>();
  const [error, setError] = useState<string>();

  const key = debts.map((d) => `${d.id}:${d.balanceGel}`).join(",");
  useEffect(() => {
    if (debts.length === 0) return setPlan(undefined);
    const value = budget.trim() === "" ? undefined : Number(budget.replace(",", "."));
    if (value !== undefined && !Number.isFinite(value)) return setError("Введите число");
    let alive = true;
    const timer = setTimeout(() => {
      fetchPlan(value)
        .then((p) => alive && (setPlan(p), setError(undefined)))
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Ошибка"));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [budget, key, debts.length]);

  if (debts.length === 0) return null;
  const chosen: PayoffPlan | undefined = plan?.[strategy];
  const other: PayoffPlan | undefined = plan?.[strategy === "avalanche" ? "snowball" : "avalanche"];
  const names = new Map(debts.map((d) => [d.id, d.name]));

  return (
    <Card title="План погашения">
      <Hint example="минимальные платежи 210 ₾, вы готовы отдавать 500 ₾ — долги закроются в разы быстрее">
        Сколько всего вы готовы платить по долгам в месяц. Не меньше суммы минимальных платежей; чем больше, тем быстрее
        свобода и меньше переплата.
      </Hint>
      <label className="row">
        <span>Платить в месяц, ₾</span>
        <input
          className="inline-input"
          aria-label="Ежемесячный платёж по долгам, лари"
          inputMode="decimal"
          placeholder={plan ? String(plan.minRequiredGel) : "минимум"}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
      </label>
      {error && <p className="hint">{error === "Проверьте введённые данные" ? "Платёж меньше суммы минимальных платежей или введён неверно" : error}</p>}
      {chosen && !error && (
        <>
          {!chosen.feasible ? (
            <p className="hint">С таким платежом долги не гасятся (проценты больше платежа). Увеличь сумму.</p>
          ) : (
            <>
              <div className="row">
                <span>Свобода от долгов</span>
                <b>{monthLabel(chosen.months)}</b>
              </div>
              <div className="row">
                <span>Это через</span>
                <b>{duration(chosen.months)}</b>
              </div>
              <div className="row">
                <span>Переплата по процентам</span>
                <b>{formatGel(chosen.totalInterestGel)}</b>
              </div>
              {other?.feasible && other.totalInterestGel !== chosen.totalInterestGel && (
                <p className="hint">
                  {other.totalInterestGel > chosen.totalInterestGel
                    ? `Эта стратегия дешевле другой на ${formatGel(other.totalInterestGel - chosen.totalInterestGel)}.`
                    : `Другая стратегия дешевле на ${formatGel(chosen.totalInterestGel - other.totalInterestGel)}.`}
                </p>
              )}
              {chosen.payoffOrder.map((p) => (
                <div key={p.id} className="row">
                  <small>{names.get(p.id) ?? "Долг"}</small>
                  <small>{monthLabel(p.month)}</small>
                </div>
              ))}
            </>
          )}
        </>
      )}
      <p className="hint">Оценка: ставка — годовая, начисление раз в месяц, платёж постоянный.</p>
    </Card>
  );
}
