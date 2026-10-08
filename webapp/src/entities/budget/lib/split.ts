export interface BudgetSplit {
  essentials: number;
  discretionary: number;
  savings: number;
}

/** 50/30/20 — подсказка, а не правило (зеркалит src/budgetRules.ts бота). */
export function suggestSplit(income: number): BudgetSplit {
  const r = (v: number) => Math.round(v * 100) / 100;
  return { essentials: r(income * 0.5), discretionary: r(income * 0.3), savings: r(income * 0.2) };
}
