import type { ReactNode } from "react";
import { Card, ProgressBar } from "@/shared/ui";
import { formatGel, percent } from "@/shared/lib/money";
import type { Goal } from "../model/api";

function paceText(g: Goal): string {
  if (g.remainingGel <= 0) return "Цель достигнута 🎉";
  if (g.monthsAtCurrentPace === null) return "Пока нет свободных денег для прогноза";
  return `При текущем темпе накоплений — примерно ${g.monthsAtCurrentPace} мес.`;
}

function requiredText(g: Goal): string | null {
  const r = g.required;
  if (!r || g.remainingGel <= 0) return null;
  if (r.overdue) return `Срок прошёл, осталось ${formatGel(g.remainingGel)}`;
  return `Чтобы успеть к ${g.targetDate}: ${formatGel(r.perMonthGel)} в месяц`;
}

export function GoalCard({ goal, actions }: { goal: Goal; actions?: ReactNode }) {
  const share = percent(goal.savedGel, goal.targetGel);
  const required = requiredText(goal);
  return (
    <Card title={goal.title}>
      <div className="row">
        <span>Накоплено</span>
        <b>
          {formatGel(goal.savedGel)} / {formatGel(goal.targetGel)}
        </b>
      </div>
      <ProgressBar value={share} label={`${share}%`} />
      <p className="hint">{paceText(goal)}</p>
      {required && <p className="hint">{required}</p>}
      {actions}
    </Card>
  );
}
