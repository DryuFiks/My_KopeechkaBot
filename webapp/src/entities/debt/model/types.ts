import { api } from "@/shared/api/client";

export interface Debt {
  id: number;
  name: string;
  balanceGel: number;
  ratePercent: number;
  minPaymentGel: number;
}

export type NewDebt = Omit<Debt, "id">;

export const fetchDebts = () => api.get<Debt[]>("/debts");
export const createDebt = (d: NewDebt) => api.post<Debt>("/debts", d);
export const deleteDebt = (id: number) => api.delete<{ deleted: boolean }>(`/debts/${id}`);
