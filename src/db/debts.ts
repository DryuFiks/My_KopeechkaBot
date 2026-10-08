import { pool } from "../db";

export interface Debt {
  id: number;
  name: string;
  balanceGel: number;
  ratePercent: number;
  minPaymentGel: number;
}

interface DebtRow {
  id: number;
  name: string;
  balance_gel: string;
  rate_percent: string;
  min_payment_gel: string;
}

function toDebt(r: DebtRow): Debt {
  return {
    id: r.id,
    name: r.name,
    balanceGel: Number(r.balance_gel),
    ratePercent: Number(r.rate_percent),
    minPaymentGel: Number(r.min_payment_gel),
  };
}

export async function listDebts(userId: number): Promise<Debt[]> {
  const res = await pool.query<DebtRow>("SELECT * FROM debts WHERE user_id=$1 ORDER BY id", [userId]);
  return res.rows.map(toDebt);
}

export async function createDebt(userId: number, d: Omit<Debt, "id">): Promise<Debt> {
  const res = await pool.query<DebtRow>(
    "INSERT INTO debts(user_id,name,balance_gel,rate_percent,min_payment_gel) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [userId, d.name, d.balanceGel, d.ratePercent, d.minPaymentGel],
  );
  return toDebt(res.rows[0]);
}

/** Returns false when nothing matched (already deleted, or not this user's) — not an error. */
export async function deleteDebt(userId: number, id: number): Promise<boolean> {
  const res = await pool.query("DELETE FROM debts WHERE id=$1 AND user_id=$2", [id, userId]);
  return (res.rowCount ?? 0) > 0;
}
