// Pure payoff simulation for the WebApp "Долги" screen (no DB, no I/O).
// A fixed monthly budget is paid every month: minimums first, everything left over goes to
// the priority debt (avalanche: highest rate; snowball: smallest balance). When a debt is
// cleared its freed-up payment automatically rolls into the next one because the budget
// stays constant. The numbers are an estimate, not a bank statement.

export type Strategy = "avalanche" | "snowball";

export interface PayoffDebt {
  id: number;
  balanceGel: number;
  ratePercent: number;
  minPaymentGel: number;
}

export interface PayoffPlan {
  strategy: Strategy;
  /** false when the budget never clears the debts within MAX_MONTHS (interest outruns payments). */
  feasible: boolean;
  months: number;
  totalInterestGel: number;
  totalPaidGel: number;
  /** Month number (1-based) in which each debt reaches zero, in payoff order. */
  payoffOrder: { id: number; month: number }[];
}

export const MAX_MONTHS = 600;

const round2 = (v: number): number => Math.round(v * 100) / 100;

export function totalMinimums(debts: PayoffDebt[]): number {
  return round2(debts.reduce((s, d) => s + (d.balanceGel > 0 ? d.minPaymentGel : 0), 0));
}

export function simulatePayoff(
  debts: PayoffDebt[],
  monthlyBudgetGel: number,
  strategy: Strategy,
): PayoffPlan {
  const state = debts.filter((d) => d.balanceGel > 0).map((d) => ({ ...d }));
  const plan: PayoffPlan = {
    strategy,
    feasible: true,
    months: 0,
    totalInterestGel: 0,
    totalPaidGel: 0,
    payoffOrder: [],
  };

  while (state.some((d) => d.balanceGel > 0.004)) {
    if (plan.months >= MAX_MONTHS) {
      return {
        ...plan,
        feasible: false,
        totalInterestGel: round2(plan.totalInterestGel),
        totalPaidGel: round2(plan.totalPaidGel),
      };
    }
    plan.months += 1;

    for (const d of state) {
      if (d.balanceGel <= 0) continue;
      const interest = (d.balanceGel * d.ratePercent) / 1200;
      d.balanceGel += interest;
      plan.totalInterestGel += interest;
    }

    let budget = monthlyBudgetGel;
    const pay = (d: (typeof state)[number], amount: number): void => {
      const paid = Math.min(amount, d.balanceGel, budget);
      d.balanceGel -= paid;
      budget -= paid;
      plan.totalPaidGel += paid;
    };

    for (const d of state) if (d.balanceGel > 0) pay(d, d.minPaymentGel);

    const open = state
      .filter((d) => d.balanceGel > 0.004)
      .sort((a, b) =>
        strategy === "avalanche" ? b.ratePercent - a.ratePercent : a.balanceGel - b.balanceGel,
      );
    for (const d of open) pay(d, budget);

    for (const d of state) {
      if (d.balanceGel <= 0.004 && !plan.payoffOrder.some((p) => p.id === d.id)) {
        d.balanceGel = 0;
        plan.payoffOrder.push({ id: d.id, month: plan.months });
      }
    }
  }

  plan.totalInterestGel = round2(plan.totalInterestGel);
  plan.totalPaidGel = round2(plan.totalPaidGel);
  return plan;
}
