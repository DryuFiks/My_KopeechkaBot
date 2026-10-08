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
  rollover: boolean;
  effectiveLimitGel: number | null;
}

export interface BudgetData {
  incomeGel: number;
  expenseGel: number;
  categories: BudgetCategory[];
  /** Расходы по дням текущего месяца до сегодняшнего дня включительно. */
  daily: number[];
  daysInMonth: number;
  projectedExpenseGel: number | null;
}

export interface CushionData {
  savingsGel: number;
  avgMonthlyExpensesGel: number;
}

export const fetchOverview = () => api.get<Overview>("/overview");
export const fetchBudget = () => api.get<BudgetData>("/budget");
export const fetchCushion = () => api.get<CushionData>("/cushion");

export const setBudgetLimit = (category: string, limitGel: number) =>
  api.put<{ ok: true }>("/budget/limit", { category, limitGel });
export const removeBudgetLimit = (category: string) =>
  api.delete<{ deleted: boolean }>(`/budget/limit?category=${encodeURIComponent(category)}`);
export const setBudgetRollover = (category: string, enabled: boolean) =>
  api.put<{ ok: true }>("/budget/rollover", { category, enabled });

export interface CategoryUsage {
  transactions: number;
  budgetMonths: number;
}

export const fetchCategories = () => api.get<{ categories: string[] }>("/categories");
export const fetchCategoryUsage = (name: string) =>
  api.get<CategoryUsage>(`/categories/usage?name=${encodeURIComponent(name)}`);
/** Удаляет категорию; если в ней есть операции, moveTo (существующая или новая) обязателен. */
export const deleteCategory = (category: string, moveTo?: string) =>
  api.post<{ movedTransactions: number; deleted: boolean }>("/categories/delete", { category, moveTo });
