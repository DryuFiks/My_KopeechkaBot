import { useState } from "react";
import { deleteGoal } from "@/entities/goal";
import { useAction } from "@/shared/lib/useAction";

/** Удаление цели с подтверждением в два нажатия; накопленное в ней перестаёт учитываться в подушке. */
export function DeleteGoal({ goalId, onDone }: { goalId: number; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const { error, busy, run } = useAction(onDone);

  if (!confirming) {
    return (
      <button type="button" className="chip" onClick={() => setConfirming(true)}>
        Удалить цель
      </button>
    );
  }
  return (
    <div className="row">
      <span>Удалить цель?</span>
      <button type="button" className="chip" disabled={busy} onClick={() => run(() => deleteGoal(goalId))}>
        Да, удалить
      </button>
      <button type="button" className="chip" disabled={busy} onClick={() => setConfirming(false)}>
        Отмена
      </button>
      {error && <small className="hint">{error}</small>}
    </div>
  );
}
