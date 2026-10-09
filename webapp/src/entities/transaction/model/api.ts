import { api } from "@/shared/api/client";
import type { Currency } from "@/shared/lib/money";

export type TransactionType = "expense" | "income";

export interface NewTransaction {
  type: TransactionType;
  amount: number;
  currency: Currency;
  category: string | null;
  note: string | null;
}

export interface CreatedTransaction {
  id: number;
  /** null — курса валюты нет, операция сохранена без пересчёта в лари. */
  amountGel: number | null;
}

/** Категории для выбора — в том же порядке, что и в чате с ботом. */
export const fetchCategoryOptions = (type: TransactionType) =>
  api.get<{ categories: string[] }>(`/transactions/categories?type=${type}`);
export const createTransaction = (t: NewTransaction) => api.post<CreatedTransaction>("/transactions", t);
export const undoTransaction = (id: number) => api.delete<{ deleted: boolean }>(`/transactions/${id}`);
