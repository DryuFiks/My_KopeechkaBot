import { useEffect, useState } from "react";
import { createTransaction, fetchCategoryOptions, type TransactionType } from "@/entities/transaction";
import { fetchSettings } from "@/entities/plan";
import { Icon, Segmented, Sheet } from "@/shared/ui";
import { CURRENCY_SIGN, formatMoney, type Currency } from "@/shared/lib/money";
import { parseAmount, useAction } from "@/shared/lib/useAction";
import { haptic } from "@/shared/lib/telegram";
import { pressKey, type Key } from "./lib/keypad";
import { readLastCurrency, saveLastCurrency } from "./lib/lastCurrency";

export interface QuickAddPreset {
  type: TransactionType;
  category?: string;
}

const CURRENCIES: Currency[] = ["GEL", "RUB", "USD"];
const KEYS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"];
const OTHER = "__other__";

/**
 * Быстрый ввод операции в шторке (MKB-052): сумма на своей клавиатуре, категория чипом, сохранить.
 * Пошаговый мастер остаётся по ссылке «Пошагово» — для тех, кто привык.
 */
export function QuickAdd({
  preset,
  onClose,
  onSaved,
  onStepwise,
}: {
  preset: QuickAddPreset;
  onClose: () => void;
  onSaved: (id: number, text: string) => void;
  onStepwise: (type: TransactionType) => void;
}) {
  const [type, setType] = useState<TransactionType>(preset.type);
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState<Currency>(readLastCurrency() ?? "GEL");
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(preset.category ?? "");
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const save = useAction();

  useEffect(() => {
    if (readLastCurrency()) return;
    fetchSettings()
      .then((s) => setCurrency(s.displayCurrency))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    fetchCategoryOptions(type)
      .then((r) => alive && setCategories(r.categories))
      .catch(() => alive && setCategories([]));
    return () => {
      alive = false;
    };
  }, [type]);

  const amount = parseAmount(value);
  const valid = Number.isFinite(amount) && amount > 0;
  const chosen = category === OTHER ? custom.trim() : category;
  const shown = preset.category && !categories.includes(preset.category) ? [preset.category, ...categories] : categories;
  const sign = type === "expense" ? "−" : "+";

  async function submit() {
    const created = await createTransaction({
      type,
      amount,
      currency,
      category: chosen || null,
      note: note.trim() || null,
    });
    saveLastCurrency(currency);
    onSaved(created.id, `Записано: ${sign}${formatMoney(amount, currency)}${chosen ? ` · ${chosen}` : ""}`);
  }

  return (
    <Sheet title="Новая операция" onClose={onClose}>
      <Segmented
        label="Тип операции"
        options={[
          { id: "expense", label: "Расход" },
          { id: "income", label: "Доход" },
        ]}
        value={type}
        onChange={(t) => {
          setType(t);
          setCategory("");
        }}
      />
      <p className={`qa-amount${value ? "" : " qa-amount--empty"}`} aria-live="polite">
        {sign}
        {value || "0"}
        {" "}
        {CURRENCY_SIGN[currency]}
      </p>
      <div className="qa-currencies" role="group" aria-label="Валюта">
        {CURRENCIES.map((c) => (
          <button
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
        {shown.map((c) => (
          <button
            key={c}
            className={`chip${c === category ? " is-active" : ""}`}
            aria-pressed={c === category}
            onClick={() => setCategory(c === category ? "" : c)}
          >
            {c}
          </button>
        ))}
        <button
          className={`chip${category === OTHER ? " is-active" : ""}`}
          aria-pressed={category === OTHER}
          onClick={() => setCategory(OTHER)}
        >
          <Icon name="plus" size={16} /> Другая
        </button>
      </div>
      {category === OTHER && (
        <div className="form">
          <input
            aria-label="Название категории"
            placeholder="Название категории"
            maxLength={60}
            value={custom}
            autoFocus
            onChange={(e) => setCustom(e.target.value)}
          />
        </div>
      )}
      <div className="keypad">
        {KEYS.map((k) => (
          <button
            key={k}
            aria-label={k === "back" ? "Стереть" : k === "," ? "Запятая" : k}
            onClick={() => {
              haptic("tap");
              setValue((v) => pressKey(v, k));
            }}
          >
            {k === "back" ? "⌫" : k}
          </button>
        ))}
      </div>
      {showNote ? (
        <div className="form">
          <input
            aria-label="Комментарий"
            placeholder="Комментарий"
            maxLength={200}
            value={note}
            autoFocus
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      ) : (
        <button className="link" onClick={() => setShowNote(true)}>
          <Icon name="comment" size={18} /> Комментарий
        </button>
      )}
      <button className="primary wide" disabled={!valid || save.busy} onClick={() => void save.run(submit)}>
        <Icon name="check" /> {valid ? `Сохранить ${sign}${formatMoney(amount, currency)}` : "Введите сумму"}
      </button>
      {save.error && (
        <p className="hint" role="alert">
          {save.error}
        </p>
      )}
      <button className="link center" onClick={() => onStepwise(type)}>
        Пошаговый ввод
      </button>
    </Sheet>
  );
}
