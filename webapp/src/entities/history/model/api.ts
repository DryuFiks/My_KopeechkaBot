import { api } from "@/shared/api/client";
import type { Currency } from "@/shared/lib/money";

export interface HistoryMonth {
  /** «YYYY-MM» в часовом поясе пользователя. */
  month: string;
  incomeGel: number;
  expenseGel: number;
  operations: number;
  /** Остаток, пришедший из прошлых месяцев. */
  openingGel: number;
  /** Остаток на конец месяца. */
  closingGel: number;
}

export interface HistoryMonthDetail {
  month: string;
  incomeGel: number;
  expenseGel: number;
  openingGel: number;
  closingGel: number;
  daysInMonth: number;
  categories: { category: string | null; amountGel: number }[];
  daily: number[];
}

export interface HistoryTransaction {
  id: number;
  type: "expense" | "income";
  amount: number;
  currency: Currency;
  amountGel: number | null;
  category: string | null;
  note: string | null;
  createdAt: string;
}

export interface HistoryTransactions {
  items: HistoryTransaction[];
  hasMore: boolean;
}

export const fetchHistory = () => api.get<{ months: HistoryMonth[] }>("/history");
export const fetchHistoryMonth = (month: string) => api.get<HistoryMonthDetail>(`/history/${month}`);
/** Фильтр операций месяца (MKB-056): текст ищется в категории и комментарии. */
export interface TransactionFilter {
  q: string;
  type: "all" | "expense" | "income";
}
export const fetchHistoryTransactions = (month: string, offset: number, filter?: TransactionFilter) => {
  const params = new URLSearchParams({ offset: String(offset) });
  if (filter?.q.trim()) params.set("q", filter.q.trim());
  if (filter && filter.type !== "all") params.set("type", filter.type);
  return api.get<HistoryTransactions>(`/history/${month}/transactions?${params}`);
};
/** Последние операции для главного экрана, от новых к старым. */
export const fetchRecentTransactions = () => api.get<{ items: HistoryTransaction[] }>("/transactions/recent");
