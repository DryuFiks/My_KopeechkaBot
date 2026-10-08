import { api } from "@/shared/api/client";
import type { Currency } from "@/shared/lib/money";

export type IncomeMode = "fixed" | "range" | "actual";

export interface Income {
  id: number;
  name: string;
  mode: IncomeMode;
  amount: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  currency: Currency;
  payDay: number | null;
  receivedThisMonth: number | null;
  expectedAmount: number;
}

export interface PlannedExpense {
  id: number;
  name: string;
  amount: number;
  currency: Currency;
  dueDay: number | null;
}

export interface PlanData {
  displayCurrency: Currency;
  exchangeFactor: number;
  onboarded: boolean;
  incomes: Income[];
  expenses: PlannedExpense[];
}

export type AllowanceStatus = "ok" | "tight" | "over";

export interface PlanSummary {
  displayCurrency: Currency;
  exchangeFactor: number;
  incomeGel: number;
  mandatoryGel: number;
  debtMinimumsGel: number;
  freeMonthGel: number;
  plannedPerDayGel: number;
  daysLeft: number;
  today: { remainingGel: number; perDayGel: number; status: AllowanceStatus };
  ratesMissing: boolean;
  /** GEL за 1 единицу основной валюты по курсу обменника; null — курса нет, показываем лари. */
  displayRateGel: number | null;
}

export interface Settings {
  displayCurrency: Currency;
  exchangeFactor: number;
  timezone: string;
  onboarded: boolean;
}

export interface NewIncome {
  name: string;
  mode: IncomeMode;
  currency: Currency;
  amount?: number;
  minAmount?: number;
  maxAmount?: number;
  payDay?: number;
}

export interface NewExpense {
  name: string;
  amount: number;
  currency: Currency;
  dueDay?: number;
}

export const fetchPlan = () => api.get<PlanData>("/plan");
export const fetchSummary = () => api.get<PlanSummary>("/plan/summary");
export const addIncome = (i: NewIncome) => api.post<Income>("/plan/income", i);
export const removeIncome = (id: number) => api.delete<{ deleted: boolean }>(`/plan/income/${id}`);
export const markReceived = (id: number, amount: number) =>
  api.put<{ ok: true }>(`/plan/income/${id}/receipt`, { amount });
export const addExpense = (e: NewExpense) => api.post<PlannedExpense>("/plan/expense", e);
export const removeExpense = (id: number) => api.delete<{ deleted: boolean }>(`/plan/expense/${id}`);

export const fetchSettings = () => api.get<Settings>("/settings");
export const updateSettings = (patch: { displayCurrency?: Currency; exchangeFactor?: number }) =>
  api.put<Settings>("/settings", patch);
export const completeOnboarding = () => api.post<Settings>("/onboarding/complete", {});
