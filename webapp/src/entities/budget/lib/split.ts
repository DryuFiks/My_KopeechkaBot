export interface BudgetSplit {
  /** Обязательные платежи — реальные, из плана пользователя. */
  essentials: number;
  /** Повседневные траты: 60% того, что осталось сверх обязательных. */
  discretionary: number;
  /** Накопления: 40% остатка сверх обязательных. */
  savings: number;
  /** Расходы месяца, попавшие в обязательные (не больше их суммы). */
  essentialsSpent: number;
  /** Расходы сверх обязательных — считаются повседневными. */
  discretionarySpent: number;
}

const DISCRETIONARY_SHARE = 0.6;
const r = (v: number) => Math.round(v * 100) / 100;

/**
 * Делит доход: сначала реальные обязательные платежи, остаток — на повседневные и накопления.
 * Это подсказка, а не правило. Факт делится так же, как на главной: пока расходы не превысили
 * обязательные, они считаются обязательными, всё сверх — повседневными.
 */
export function splitAfterMandatory(income: number, mandatory: number, expense: number): BudgetSplit {
  const rest = Math.max(0, income - mandatory);
  const discretionary = r(rest * DISCRETIONARY_SHARE);
  return {
    essentials: r(mandatory),
    discretionary,
    savings: r(rest - discretionary),
    essentialsSpent: r(Math.min(expense, mandatory)),
    discretionarySpent: r(Math.max(0, expense - mandatory)),
  };
}
