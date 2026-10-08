import { api } from "@/shared/api/client";

export interface Overview {
  name: string;
  incomeGel: number;
  expenseGel: number;
}

export interface BudgetCategory {
  category: string | null;
  limitGel: number | null;
  spentGel: number;
  effectiveLimitGel: number | null;
}

export interface BudgetData {
  incomeGel: number;
  categories: BudgetCategory[];
}

export interface CushionData {
  savingsGel: number;
  avgMonthlyExpensesGel: number;
}

export const fetchOverview = () => api.get<Overview>("/overview");
export const fetchBudget = () => api.get<BudgetData>("/budget");
export const fetchCushion = () => api.get<CushionData>("/cushion");
