import { useState, type FormEvent } from "react";
import { Card } from "@/shared/ui";
import { createGoal } from "@/entities/goal";

export function AddGoalForm({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await createGoal({
        title: title.trim(),
        targetGel: Number(target.replace(",", ".")),
        targetDate: date || undefined,
      });
      setTitle("");
      setTarget("");
      setDate("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Новая цель">
      <form className="form" onSubmit={submit}>
        <input aria-label="Название цели" placeholder="Название" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} required />
        <input aria-label="Сумма цели, лари" placeholder="Сумма, ₾" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} required />
        <input type="date" aria-label="Срок (необязательно)" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="submit" disabled={busy}>
          Создать
        </button>
        {error && <p className="hint">{error}</p>}
      </form>
    </Card>
  );
}
