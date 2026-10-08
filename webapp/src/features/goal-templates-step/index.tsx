import { useState } from "react";
import { createGoal, fetchGoals } from "@/entities/goal";
import type { GoalTemplate, PlanSummary } from "@/entities/plan";
import { Hint, Status } from "@/shared/ui";
import { addMonths, toDateString } from "@/shared/lib/date";
import { formatGel } from "@/shared/lib/money";
import { parseAmount, useAction } from "@/shared/lib/useAction";
import { useAsync } from "@/shared/lib/useAsync";

const DESCRIPTION: Record<GoalTemplate["code"], string> = {
  cushion: "Запас на случай потери дохода: 3 месяца обязательных расходов.",
  vacation: "Откладываем небольшую сумму каждый месяц — хватит на поездку примерно через полгода.",
  purchase: "Техника, ремонт, большой подарок — цель на год.",
};

function Template({ t, taken, onCreated }: { t: GoalTemplate; taken: boolean; onCreated: () => void }) {
  const [target, setTarget] = useState(String(t.targetGel));
  const { error, busy, run } = useAction(onCreated);
  const canPlan = t.monthlyGel > 0;

  return (
    <div className="row-block">
      <div className="row">
        <b>{t.title}</b>
        {taken && <small>уже создана ✓</small>}
      </div>
      <p className="hint">{DESCRIPTION[t.code]}</p>
      {canPlan && (
        <p className="hint">
          Откладывать {formatGel(t.monthlyGel)} в месяц — цель будет достигнута примерно через {t.months} мес.
        </p>
      )}
      {!taken && (
        <div className="limit-controls">
          <input
            className="inline-input"
            aria-label={`Сумма цели «${t.title}», лари`}
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <button
            className="chip"
            disabled={busy || !canPlan}
            onClick={() =>
              run(() =>
                createGoal({
                  title: t.title,
                  targetGel: parseAmount(target),
                  targetDate: toDateString(addMonths(new Date(), t.months)),
                }),
              )
            }
          >
            Создать цель
          </button>
        </div>
      )}
      {error && (
        <small className="hint" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

/** Шаг 6: готовые цели с суммой и сроком из ваших цифр; повторно одну и ту же не создаём. */
export function GoalTemplatesStep({ summary }: { summary: PlanSummary }) {
  const goals = useAsync(fetchGoals);
  const noMoney = summary.goalTemplates.every((t) => t.monthlyGel <= 0);
  return (
    <>
      <Hint example="свободно 1600 ₾ → откладываем 320 ₾ (20%) в месяц">
        Предлагаем откладывать до 20% свободных денег. Сумму цели можно изменить; срок посчитаем сами.
      </Hint>
      {noMoney && (
        <p className="hint">
          Пока свободных денег нет, поэтому срок не посчитать. Вернитесь к доходам и расходам или пропустите шаг.
        </p>
      )}
      <Status state={goals}>
        {(g) =>
          summary.goalTemplates.map((t) => (
            <Template key={t.code} t={t} taken={g.goals.some((x) => x.title === t.title)} onCreated={goals.reload} />
          ))
        }
      </Status>
    </>
  );
}
