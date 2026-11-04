import { useState, type FormEvent } from "react";
import { createPayment, deletePayment, fetchPayments, togglePayment, whenLabel, type Payment } from "@/entities/payment";
import { Card, EmptyState, Hint, Icon, Status } from "@/shared/ui";
import { CURRENCY_SIGN, formatMoney, type Currency } from "@/shared/lib/money";
import { parseAmount, useAction } from "@/shared/lib/useAction";
import { useAsync } from "@/shared/lib/useAsync";

const CURRENCIES: Currency[] = ["GEL", "RUB", "USD"];

function PaymentRow({ p, onChanged }: { p: Payment; onChanged: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const { busy, error, run } = useAction(onChanged);
  return (
    <div className={`row-block${p.active ? "" : " is-paused"}`}>
      <div className="row">
        <span>
          {p.title}
          <small> · {p.dueDay}-го числа{p.active ? ` · ${whenLabel(p.next.inDays)}` : " · на паузе"}</small>
        </span>
        <b className="amount">{formatMoney(p.amount, p.currency)}</b>
      </div>
      <div className="limit-controls">
        <button className="chip chip--soft" disabled={busy} onClick={() => void run(() => togglePayment(p.id))}>
          {p.active ? "Пауза" : "Возобновить"}
        </button>
        {confirm ? (
          <>
            <button className="chip chip--danger" disabled={busy} onClick={() => void run(() => deletePayment(p.id))}>
              Да, удалить
            </button>
            <button className="chip chip--soft" onClick={() => setConfirm(false)}>
              Отмена
            </button>
          </>
        ) : (
          <button className="chip chip--danger" aria-label={`Удалить платёж «${p.title}»`} onClick={() => setConfirm(true)}>
            <Icon name="trash" size={16} />
          </button>
        )}
      </div>
      {error && <small className="hint">{error}</small>}
    </div>
  );
}

function AddPayment({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("GEL");
  const [day, setDay] = useState("1");
  const { busy, error, run } = useAction(() => {
    setTitle("");
    setAmount("");
    onAdded();
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => createPayment({ title: title.trim(), amount: parseAmount(amount), currency, dueDay: Number(day) }));
  };
  return (
    <form className="form" onSubmit={submit}>
      <input aria-label="Название" placeholder="Название, например Интернет" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="limit-controls">
        <input className="inline-input" aria-label="Сумма" placeholder="Сумма" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select aria-label="Валюта" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {CURRENCY_SIGN[c]} {c}
            </option>
          ))}
        </select>
        <select aria-label="День месяца" value={day} onChange={(e) => setDay(e.target.value)}>
          {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
            <option key={d} value={d}>
              {d}-го
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={busy || !title.trim() || !(parseAmount(amount) > 0)}>
        <Icon name="plus" /> Добавить платёж
      </button>
      {error && (
        <p className="hint" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * «Бюджет → Платежи» (MKB-059): регулярные платежи — то же, что /payment в чате. Бот напомнит в день платежа
 * (если напоминания о платежах включены), а записать расход можно прямо из напоминания.
 */
export function Payments() {
  const state = useAsync(fetchPayments);
  return (
    <>
      <Hint>В день платежа бот пришлёт напоминание с кнопкой «Записать». Платёж на 31-е в коротком месяце — в его последний день.</Hint>
      <Card title="Регулярные платежи">
        <Status state={state}>
          {({ items }) =>
            items.length === 0 ? (
              <EmptyState icon="calendar" text="Платежей пока нет — добавьте аренду, связь или подписки ниже." />
            ) : (
              items.map((p) => <PaymentRow key={p.id} p={p} onChanged={state.reload} />)
            )
          }
        </Status>
      </Card>
      <Card title="Новый платёж">
        <AddPayment onAdded={state.reload} />
      </Card>
    </>
  );
}
