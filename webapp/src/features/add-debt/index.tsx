import { useState, type FormEvent } from "react";
import { Card } from "@/shared/ui";
import { createDebt } from "@/entities/debt";

export function AddDebtForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [rate, setRate] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await createDebt({
        name: name.trim(),
        balanceGel: Number(balance.replace(",", ".")),
        ratePercent: Number(rate.replace(",", ".") || 0),
        minPaymentGel: 0,
      });
      setName("");
      setBalance("");
      setRate("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Добавить долг">
      <form className="form" onSubmit={submit}>
        <input aria-label="Название долга" placeholder="Название" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
        <input aria-label="Остаток долга, лари" placeholder="Остаток, ₾" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} required />
        <input aria-label="Ставка, процентов годовых" placeholder="Ставка, % годовых" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        <button type="submit" disabled={busy}>
          Добавить
        </button>
        {error && <p className="hint">{error}</p>}
      </form>
    </Card>
  );
}
