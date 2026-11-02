/** Две полосы на одной шкале: серая — план (цель), цветная — факт. Подписи уже отформатированы вызывающим. */
export function PlanFactBar({
  title,
  plan,
  fact,
  planText,
  factText,
  over = false,
}: {
  title: string;
  plan: number;
  fact: number;
  planText: string;
  factText: string;
  /** Факт «плохо» превышает план (например, расходы выше обязательных) — полоса красная. */
  over?: boolean;
}) {
  const scale = Math.max(plan, fact, 1);
  const width = (v: number) => `${Math.min(100, Math.max(0, (v / scale) * 100))}%`;
  return (
    <div className="planfact" role="group" aria-label={`${title}: план ${planText}, факт ${factText}`}>
      <div className="row">
        <span>{title}</span>
        <small>
          план {planText} · факт <b>{factText}</b>
        </small>
      </div>
      <div className="planfact__bar">
        <div className="planfact__fill planfact__fill--plan" style={{ width: width(plan) }} />
      </div>
      <div className="planfact__bar">
        <div
          className={`planfact__fill planfact__fill--fact${over ? " planfact__fill--over" : ""}`}
          style={{ width: width(fact) }}
        />
      </div>
    </div>
  );
}
