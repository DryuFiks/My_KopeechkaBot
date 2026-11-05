import { useEffect, useState } from "react";
import { fetchCategoryOptions, undoTransaction, updateTransaction } from "@/entities/transaction";
import type { HistoryTransaction } from "@/entities/history";
import { Icon, Sheet } from "@/shared/ui";
import { CURRENCY_SIGN, type Currency } from "@/shared/lib/money";
import { toDateString } from "@/shared/lib/date";
import { parseAmount, useAction } from "@/shared/lib/useAction";

const CURRENCIES: Currency[] = ["GEL", "RUB", "USD"];

/**
 * Правка операции в шторке (MKB-053): сумма, валюта, категория, день, комментарий; удаление — со
 * вторым нажатием. Тип (расход/доход) не меняется: для этого проще удалить и записать заново.
 */
export function EditTransaction({
  t,
  onClose,
  onChanged,
}: {
  t: HistoryTransaction;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [value, setValue] = useState(String(t.amount).replace(".", ","));
  const [currency, setCurrency] = useState<Currency>(t.currency);
  const [category, setCategory] = useState(t.category ?? "");
  const [categories, setCategories] = useState<string[]>([]);
  const [date, setDate] = useState(toDateString(new Date(t.createdAt)));
  const [note, setNote] = useState(t.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const action = useAction(() => {
    onChanged();
    onClose();
  });

  useEffect(() => {
    fetchCategoryOptions(t.type)
      .then((r) => setCategories(r.categories))
      .catch(() => setCategories([]));
  }, [t.type]);

  const amount = parseAmount(value);
  const valid = Number.isFinite(amount) && amount > 0 && date !== "";
  const shown = category && !categories.includes(category) ? [category, ...categories] : categories;

  return (
    <Sheet title={t.type === "expense" ? "Расход" : "Доход"} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          void action.run(() =>
            updateTransaction(t.id, { amount, currency, category: category || null, note: note.trim() || null, date }),
          );
        }}
      >
        <label className="field">
          <span>Сумма</span>
          <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <div className="qa-currencies" role="group" aria-label="Валюта">
          {CURRENCIES.map((c) => (
            <button
              type="button"
              key={c}
              className={`chip chip--soft${c === currency ? " is-active" : ""}`}
              aria-pressed={c === currency}
              onClick={() => setCurrency(c)}
            >
              {CURRENCY_SIGN[c]} {c}
            </button>
          ))}
        </div>
        <div className="month-chips" role="group" aria-label="Категория">
          <button
            type="button"
            className={`chip${category === "" ? " is-active" : ""}`}
            aria-pressed={category === ""}
            onClick={() => setCategory("")}
          >
            Без категории
          </button>
          {shown.map((c) => (
            <button
              type="button"
              key={c}
              className={`chip${c === category ? " is-active" : ""}`}
              aria-pressed={c === category}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="field">
          <span>День</span>
          <input type="date" value={date} max={toDateString(new Date())} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Комментарий</span>
          <input maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="submit" disabled={!valid || action.busy}>
          <Icon name="check" /> Сохранить
        </button>
      </form>
      {action.error && (
        <p className="hint" role="alert">
          {action.error}
        </p>
      )}
      <div className="stepper-nav">
        {confirmDelete ? (
          <>
            <button
              className="chip chip--danger"
              disabled={action.busy}
              onClick={() => void action.run(() => undoTransaction(t.id))}
            >
              <Icon name="trash" size={18} /> Да, удалить
            </button>
            <button className="chip chip--soft" onClick={() => setConfirmDelete(false)}>
              Отмена
            </button>
          </>
        ) : (
          <button className="chip chip--danger" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={18} /> Удалить операцию
          </button>
        )}
      </div>
    </Sheet>
  );
}
