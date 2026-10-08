import { useState, type FormEvent } from "react";
import { Card } from "@/shared/ui";
import { removeBudgetLimit, setBudgetLimit, setBudgetRollover } from "@/entities/budget";
import type { BudgetCategory } from "@/entities/budget";

function useAction(onDone: () => void) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, run };
}

const parse = (s: string) => Number(s.replace(",", "."));

/** Правка лимита категории, перенос остатка, удаление лимита. */
export function LimitControls({
  row,
  onChanged,
}: {
  row: BudgetCategory & { category: string };
  onChanged: () => void;
}) {
  const [value, setValue] = useState(row.limitGel === null ? "" : String(row.limitGel));
  const { error, busy, run } = useAction(onChanged);
  const hasLimit = row.limitGel !== null;

  return (
    <div className="limit-controls">
      <input
        className="inline-input"
        aria-label={`Лимит для ${row.category}`}
        inputMode="decimal"
        placeholder="Лимит, ₾"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button className="chip" disabled={busy} onClick={() => run(() => setBudgetLimit(row.category, parse(value)))}>
        Сохранить
      </button>
      {hasLimit && (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={row.rollover}
              disabled={busy}
              onChange={(e) => run(() => setBudgetRollover(row.category, e.target.checked))}
            />
            остаток переносится
          </label>
          <button className="link" disabled={busy} onClick={() => run(() => removeBudgetLimit(row.category))}>
            Убрать лимит
          </button>
        </>
      )}
      {error && <small className="hint">{error}</small>}
    </div>
  );
}

export function AddLimitForm({ known, onAdded }: { known: string[]; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");
  const { error, busy, run } = useAction(() => {
    setName("");
    setLimit("");
    onAdded();
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(() => setBudgetLimit(name.trim(), parse(limit)));
  }

  return (
    <Card title="Новый лимит на месяц">
      <form className="form" onSubmit={submit}>
        <input
          list="known-categories"
          aria-label="Категория"
          placeholder="Категория"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <datalist id="known-categories">
          {known.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
        <input
          aria-label="Лимит, лари"
          placeholder="Лимит, ₾"
          inputMode="decimal"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          required
        />
        <button type="submit" disabled={busy}>
          Задать лимит
        </button>
        {error && <p className="hint">{error}</p>}
      </form>
    </Card>
  );
}
