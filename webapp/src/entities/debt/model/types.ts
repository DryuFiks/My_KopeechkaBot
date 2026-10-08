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

export interface PayoffPlan {
  strategy: "avalanche" | "snowball";
  feasible: boolean;
  months: number;
  totalInterestGel: number;
  totalPaidGel: number;
  payoffOrder: { id: number; month: number }[];
}

export interface PlanComparison {
  monthlyGel: number;
  minRequiredGel: number;
  avalanche: PayoffPlan;
  snowball: PayoffPlan;
}

export const fetchPlan = (monthly?: number) =>
  api.get<PlanComparison>(`/debts/plan${monthly === undefined ? "" : `?monthly=${monthly}`}`);
