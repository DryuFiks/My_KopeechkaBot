import { formatMoney } from "@/shared/lib/money";
import type { HistoryTransaction } from "../model/api";

/**
 * Одна операция: категория, дата, комментарий и сумма со знаком (доход — зелёным).
 * С `onSelect` строка становится кнопкой — открыть операцию для правки (MKB-053).
 */
export function TransactionRow({ t, onSelect }: { t: HistoryTransaction; onSelect?: (t: HistoryTransaction) => void }) {
  const income = t.type === "income";
  const day = new Date(t.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  const content = (
    <>
      <span>
        {t.category ?? "Без категории"}
        <small> · {day}</small>
        {t.note && <small> · {t.note}</small>}
      </span>
      <b className={`amount${income ? " amount--income" : ""}`}>
        {income ? "+" : "−"}
        {formatMoney(t.amount, t.currency)}
      </b>
    </>
  );
  if (!onSelect) return <div className="row">{content}</div>;
  return (
    <button
      type="button"
      className="row tx-row"
      aria-label={`Изменить: ${t.category ?? "без категории"}, ${income ? "+" : "−"}${formatMoney(t.amount, t.currency)}, ${day}`}
      onClick={() => onSelect(t)}
    >
      {content}
    </button>
  );
}
