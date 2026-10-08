import { describe, expect, it } from "vitest";
import { orderDebts } from "./order";
import type { Debt } from "../model/types";

const debts: Debt[] = [
  { id: 1, name: "a", balanceGel: 3000, ratePercent: 10, minPaymentGel: 0 },
  { id: 2, name: "b", balanceGel: 500, ratePercent: 30, minPaymentGel: 0 },
  { id: 3, name: "c", balanceGel: 1000, ratePercent: 20, minPaymentGel: 0 },
];

describe("orderDebts", () => {
  it("avalanche: highest rate first", () => {
    expect(orderDebts(debts, "avalanche").map((d) => d.id)).toEqual([2, 3, 1]);
  });
  it("snowball: smallest balance first", () => {
    expect(orderDebts(debts, "snowball").map((d) => d.id)).toEqual([2, 3, 1]);
    const other = debts.map((d) => (d.id === 1 ? { ...d, balanceGel: 100 } : d));
    expect(orderDebts(other, "snowball")[0].id).toBe(1);
  });
  it("does not mutate the input", () => {
    const copy = [...debts];
    orderDebts(debts, "avalanche");
    expect(debts).toEqual(copy);
  });
});
