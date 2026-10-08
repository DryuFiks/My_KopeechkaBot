export interface Debt {
  id: number;
  name: string;
  balanceGel: number;
  ratePercent: number;
  minPaymentGel: number;
}

export const MOCK_DEBTS: Debt[] = [
  { id: 1, name: "Кредитная карта", balanceGel: 1200, ratePercent: 28, minPaymentGel: 60 },
  { id: 2, name: "Рассрочка телефон", balanceGel: 600, ratePercent: 0, minPaymentGel: 100 },
  { id: 3, name: "Кредит на ремонт", balanceGel: 3500, ratePercent: 16, minPaymentGel: 150 },
];
