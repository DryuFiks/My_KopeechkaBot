import { useState, type FormEvent } from "react";
import { addExpense, removeExpense } from "@/entities/plan";
import type { PlanData } from "@/entities/plan";
import { ChipRow, Hint } from "@/shared/ui";
import { CURRENCY_SIGN, formatMoney, type Currency } from "@/shared/lib/money";
import { parseAmount, useAction } from "@/shared/lib/useAction";

const NAMES = ["Аренда жилья", "Коммуналка", "Интернет и связь", "Транспорт", "Подписки"];

/** Шаг 3: обязательные расходы месяца. Долги учитываются отдельно — на вкладке «Долги». */
export function ExpenseStep({ plan, onChanged }: { plan: PlanData; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(plan.displayCurrency);
  const { error, busy, run } = useAction(onChanged);
  const del = useAction(onChanged);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run(() => addExpense({ name: name.trim(), amount: parseAmount(amount), currency }));
    if (ok) {
      setName("");
      setAmount("");
    }
  }

  return (
    <>
      <Hint example="аренда жилья 800 ₾; коммуналка 120 ₾; интернет 30 ₾">
        Платежи, которые нужно внести в любом случае. Еду и развлечения сюда не добавляйте — они появятся в бюджете.
        Кредиты и рассрочки лучше завести во вкладке «Долги»: их минимальные платежи мы учтём сами.
      </Hint>

      {plan.expenses.map((e) => (
        <div key={e.id} className="row">
          <span>{e.name}</span>
          <span>
            <b>{formatMoney(e.amount, e.currency)}</b>{" "}
            <button className="link" aria-label={`Удалить ${e.name}`} onClick={() => del.run(() => removeExpense(e.id))}>
              ✕
            </button>
          </span>
        </div>
      ))}

      <form className="form" onSubmit={submit}>
        <ChipRow label="Быстрый выбор расхода" options={NAMES} onPick={setName} />
        <input aria-label="Название расхода" placeholder="Название" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
        <input aria-label="Сумма в месяц" placeholder={`Сумма в месяц, ${CURRENCY_SIGN[currency]}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <div className="row">
          <label htmlFor="expense-currency">Валюта</label>
          <select id="expense-currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {(["GEL", "RUB", "USD"] as Currency[]).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={busy}>
          Добавить расход
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
