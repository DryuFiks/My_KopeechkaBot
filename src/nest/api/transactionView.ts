import type { Transaction } from "../../db";

/** One operation as the WebApp sees it (history list, recent operations on the home screen). */
export function presentTransaction(t: Transaction) {
  return {
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    currency: t.currency,
    amountGel: t.amount_gel === null ? null : Number(t.amount_gel),
    category: t.category,
    note: t.note,
    createdAt: t.created_at.toISOString(),
  };
}
