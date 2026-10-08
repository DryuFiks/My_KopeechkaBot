import { useState, type FormEvent } from "react";
import { contributeToGoal } from "@/entities/goal";

export function ContributeForm({ goalId, onDone }: { goalId: number; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await contributeToGoal(goalId, Number(amount.replace(",", ".")));
      setAmount("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="row" onSubmit={submit}>
      <input
        className="inline-input"
        style={{ textAlign: "left", flex: 1 }}
        placeholder="Пополнить, ₾"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <button className="chip" type="submit" disabled={busy}>
        +
      </button>
      {error && <small className="hint">{error}</small>}
    </form>
  );
}
