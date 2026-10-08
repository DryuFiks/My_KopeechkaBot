import { useState, type FormEvent } from "react";
import { addIncome, markReceived, removeIncome } from "@/entities/plan";
import type { Income, IncomeMode, PlanData } from "@/entities/plan";
import { ChipRow, Hint } from "@/shared/ui";
import { CURRENCY_SIGN, formatMoney, type Currency } from "@/shared/lib/money";
import { parseAmount, useAction } from "@/shared/lib/useAction";

const NAMES = ["Работа", "Аренда квартиры", "Подработка", "Пособие/пенсия", "Другое"];
const MODES: { mode: IncomeMode; label: string }[] = [
  { mode: "fixed", label: "Стабильный" },
  { mode: "range", label: "От и до" },
  { mode: "actual", label: "По факту" },
];
const MODE_HINT: Record<IncomeMode, string> = {
  fixed: "Одна и та же сумма каждый месяц.",
  range: "Доход плавает: укажите минимум и максимум — считаем по среднему.",
  actual: "Сумма каждый раз разная: отмечайте, сколько получили. Если не отметили — берём среднее за прошлые месяцы.",
};

function describe(i: Income): string {
  if (i.mode === "range" && i.minAmount !== null && i.maxAmount !== null) {
    return `${formatMoney(i.minAmount, i.currency)} – ${formatMoney(i.maxAmount, i.currency)}`;
  }
  return i.mode === "fixed" ? "каждый месяц" : "по факту";
}

function ReceivedInput({ income, onChanged }: { income: Income; onChanged: () => void }) {
  const [value, setValue] = useState(income.receivedThisMonth === null ? "" : String(income.receivedThisMonth));
  const { error, busy, run } = useAction(onChanged);
  return (
    <div className="limit-controls">
      <input
        className="inline-input"
        aria-label={`Получено в этом месяце: ${income.name}`}
        placeholder={`Получил, ${CURRENCY_SIGN[income.currency]}`}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button className="chip" disabled={busy} onClick={() => run(() => markReceived(income.id, parseAmount(value)))}>
        Отметить
      </button>
      {error && <small className="hint">{error}</small>}
    </div>
  );
}

/** Шаг 2: источники дохода в месяц. */
export function IncomeStep({ plan, onChanged }: { plan: PlanData; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<IncomeMode>("fixed");
  const [currency, setCurrency] = useState<Currency>(plan.displayCurrency);
  const [amount, setAmount] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const { error, busy, run } = useAction(onChanged);
  const del = useAction(onChanged);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      addIncome({
        name: name.trim(),
        mode,
        currency,
        ...(mode === "fixed" ? { amount: parseAmount(amount) } : {}),
        ...(mode === "range" ? { minAmount: parseAmount(min), maxAmount: parseAmount(max) } : {}),
      }),
    );
    if (ok) {
      setName("");
      setAmount("");
      setMin("");
      setMax("");
    }
  }

  return (
    <>
      <Hint example="зарплата 3000 ₾; аренда квартиры 800 ₾; подработка от 500 до 1500 ₾">
        Сколько приходит в обычный месяц. Нестабильный доход — выберите «От и до» или «По факту».
      </Hint>

      {plan.incomes.map((i) => (
        <div key={i.id} className="row-block">
          <div className="row">
            <span>
              {i.name} <small>({describe(i)})</small>
            </span>
            <span>
              <b>{formatMoney(i.expectedAmount, i.currency)}</b>{" "}
              <button className="link" aria-label={`Удалить ${i.name}`} onClick={() => del.run(() => removeIncome(i.id))}>
                ✕
              </button>
            </span>
          </div>
          {i.mode === "actual" && <ReceivedInput income={i} onChanged={onChanged} />}
        </div>
      ))}

      <form className="form" onSubmit={submit}>
        <ChipRow label="Быстрый выбор источника" options={NAMES} onPick={setName} />
        <input aria-label="Название источника" placeholder="Название" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
        <div className="segmented" role="radiogroup" aria-label="Тип дохода">
          {MODES.map((m) => (
            <button
              type="button"
              key={m.mode}
              role="radio"
              aria-checked={mode === m.mode}
              className={mode === m.mode ? "is-active" : ""}
              onClick={() => setMode(m.mode)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="hint">{MODE_HINT[mode]}</p>
        <div className="row">
          <label htmlFor="income-currency">Валюта дохода</label>
          <select id="income-currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {(["GEL", "RUB", "USD"] as Currency[]).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {mode === "fixed" && (
          <input aria-label="Сумма в месяц" placeholder={`Сумма в месяц, ${CURRENCY_SIGN[currency]}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        )}
        {mode === "range" && (
          <>
            <input aria-label="Минимум в месяц" placeholder={`Минимум, ${CURRENCY_SIGN[currency]}`} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} required />
            <input aria-label="Максимум в месяц" placeholder={`Максимум, ${CURRENCY_SIGN[currency]}`} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} required />
          </>
        )}
        <button type="submit" disabled={busy}>
          Добавить источник
        </button>
        {(error || del.error) && (
          <p className="hint" role="alert">
            {error ?? del.error}
          </p>
        )}
      </form>
    </>
  );
}
