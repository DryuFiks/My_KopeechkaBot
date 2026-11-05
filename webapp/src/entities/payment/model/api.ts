import { api } from "@/shared/api/client";
import type { Currency } from "@/shared/lib/money";

/** Регулярный платёж (MKB-059) — те же записи, что /payment в чате; напоминание, а не операция. */
export interface Payment {
  id: number;
  title: string;
  amount: number;
  currency: Currency;
  category: string | null;
  dueDay: number;
  active: boolean;
  /** Ближайшая дата платежа (сегодня включительно) и сколько до неё дней. */
  next: { iso: string; inDays: number };
}

export interface NewPayment {
  title: string;
  amount: number;
  currency: Currency;
  dueDay: number;
}

export const fetchPayments = () => api.get<{ items: Payment[] }>("/payments");
export const createPayment = (p: NewPayment) => api.post<Payment>("/payments", p);
export const togglePayment = (id: number) => api.post<Payment>(`/payments/${id}/toggle`, {});
export const deletePayment = (id: number) => api.delete<{ deleted: boolean }>(`/payments/${id}`);

/** «сегодня» / «завтра» / «через 5 дн.» — для ближайших платежей. */
export function whenLabel(inDays: number): string {
  if (inDays <= 0) return "сегодня";
  if (inDays === 1) return "завтра";
  return `через ${inDays} дн.`;
}

/** Активные платежи, ближайшие первыми. */
export function upcoming(items: Payment[], limit: number): Payment[] {
  return items
    .filter((p) => p.active)
    .sort((a, b) => a.next.inDays - b.next.inDays)
    .slice(0, limit);
}
