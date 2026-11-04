import { formatMoney } from "@/shared/lib/money";
import type { HistoryTransaction } from "../model/api";

/** Одна операция: категория, дата, комментарий и сумма со знаком (доход — зелёным). */
export function TransactionRow({ t }: { t: HistoryTransaction }) {
  const income = t.type === "income";
  const day = new Date(t.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return (
    <div className="row">
      <span>
        {t.category ?? "Без категории"}
        <small> · {day}</small>
        {t.note && <small> · {t.note}</small>}
      </span>
      <b className={`amount${income ? " amount--income" : ""}`}>
        {income ? "+" : "−"}
        {formatMoney(t.amount, t.currency)}
      </b>
    </div>
  );
}
