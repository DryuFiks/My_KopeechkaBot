import { api } from "@/shared/api/client";

export interface RequiredPace {
  monthsLeft: number;
  perMonthGel: number;
  overdue: boolean;
}

export interface Goal {
  id: number;
  title: string;
  targetGel: number;
  savedGel: number;
  remainingGel: number;
  targetDate: string | null;
  monthsAtCurrentPace: number | null;
  required: RequiredPace | null;
}

export interface GoalsData {
  monthlySavingsGel: number;
  goals: Goal[];
}

export const fetchGoals = () => api.get<GoalsData>("/goals");
export const createGoal = (g: { title: string; targetGel: number; targetDate?: string }) =>
  api.post<Goal>("/goals", g);
export const contributeToGoal = (id: number, amountGel: number) =>
  api.post<Goal>(`/goals/${id}/contribute`, { amountGel });
