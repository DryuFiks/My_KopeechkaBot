// A suggested budget split — never a rule the app enforces. The user can use it as a
// starting point for their own /budget limits, or ignore it entirely (MKB-011: "шаблоны
// бюджета предлагать как опцию, не как универсальную норму").

export interface BudgetSplit {
  essentialsGel: number;
  discretionaryGel: number;
  savingsGel: number;
}

const ESSENTIALS_SHARE = 0.5;
const DISCRETIONARY_SHARE = 0.3;
const SAVINGS_SHARE = 0.2;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The classic 50/30/20 split (essentials/discretionary/savings) for a given monthly income. */
export function suggestBudgetSplit(monthlyIncomeGel: number): BudgetSplit {
  return {
    essentialsGel: round2(monthlyIncomeGel * ESSENTIALS_SHARE),
    discretionaryGel: round2(monthlyIncomeGel * DISCRETIONARY_SHARE),
    savingsGel: round2(monthlyIncomeGel * SAVINGS_SHARE),
  };
}

export type CategoryKind = "recurring" | "variable" | "irregular";

export const CATEGORY_KIND_LABEL: Record<CategoryKind, string> = {
  recurring: "Обязательные платежи",
  variable: "Повседневные траты",
  irregular: "Нерегулярные/крупные",
};

export const CATEGORY_KIND_ORDER: CategoryKind[] = ["recurring", "variable", "irregular"];
