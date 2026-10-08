import { pool } from "../db";
import type { IncomeMode } from "../monthPlan";
import type { SupportedCurrency } from "../currencies";

export interface IncomeSource {
  id: number;
  name: string;
  mode: IncomeMode;
  amount: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  currency: SupportedCurrency;
  payDay: number | null;
}

export interface PlannedExpense {
  id: number;
  name: string;
  amount: number;
  currency: SupportedCurrency;
  dueDay: number | null;
}

interface IncomeRow {
  id: number;
  name: string;
  mode: IncomeMode;
  amount: string | null;
  min_amount: string | null;
  max_amount: string | null;
  currency: SupportedCurrency;
  pay_day: number | null;
}

const num = (v: string | null): number | null => (v === null ? null : Number(v));

function toIncome(r: IncomeRow): IncomeSource {
  return {
    id: r.id,
    name: r.name,
    mode: r.mode,
    amount: num(r.amount),
    minAmount: num(r.min_amount),
    maxAmount: num(r.max_amount),
    currency: r.currency,
    payDay: r.pay_day,
  };
}

export async function listIncomeSources(userId: number): Promise<IncomeSource[]> {
  const res = await pool.query<IncomeRow>("SELECT * FROM income_sources WHERE user_id=$1 ORDER BY id", [
    userId,
  ]);
  return res.rows.map(toIncome);
}

export async function createIncomeSource(userId: number, s: Omit<IncomeSource, "id">): Promise<IncomeSource> {
  const res = await pool.query<IncomeRow>(
    `INSERT INTO income_sources(user_id,name,mode,amount,min_amount,max_amount,currency,pay_day)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [userId, s.name, s.mode, s.amount, s.minAmount, s.maxAmount, s.currency, s.payDay],
  );
  return toIncome(res.rows[0]);
}

/** Returns false when nothing matched (already deleted, or not this user's) — not an error. */
export async function deleteIncomeSource(userId: number, id: number): Promise<boolean> {
  const res = await pool.query("DELETE FROM income_sources WHERE id=$1 AND user_id=$2", [id, userId]);
  return (res.rowCount ?? 0) > 0;
}

/** Marks (or replaces) what was received from a source in `month`; false if the source isn't this user's. */
export async function upsertReceipt(
  userId: number,
  sourceId: number,
  month: Date,
  amount: number,
): Promise<boolean> {
  const res = await pool.query(
    `INSERT INTO income_receipts(user_id,source_id,month,amount)
     SELECT $1, id, $3, $4 FROM income_sources WHERE id=$2 AND user_id=$1
     ON CONFLICT (source_id, month) DO UPDATE SET amount = EXCLUDED.amount`,
    [userId, sourceId, month, amount],
  );
  return (res.rowCount ?? 0) > 0;
}

export interface ReceiptRow {
  sourceId: number;
  amount: number;
  /** true when the receipt belongs to the month passed to listReceipts, false for earlier months. */
  isCurrentMonth: boolean;
}

/**
 * Receipts for the month that contains `month` and up to three months before it, newest first.
 * Month matching is done in SQL with the same date cast used on insert, so the user's timezone
 * and the server's never disagree about which month a receipt belongs to.
 */
export async function listReceipts(userId: number, month: Date): Promise<ReceiptRow[]> {
  const res = await pool.query<{ source_id: number; amount: string; is_current: boolean }>(
    `SELECT source_id, amount, (month = $2::date) AS is_current
     FROM income_receipts
     WHERE user_id=$1 AND month <= $2::date AND month > ($2::date - INTERVAL '4 months')
     ORDER BY month DESC`,
    [userId, month],
  );
  return res.rows.map((r) => ({
    sourceId: r.source_id,
    amount: Number(r.amount),
    isCurrentMonth: r.is_current,
  }));
}

interface ExpenseRow {
  id: number;
  name: string;
  amount: string;
  currency: SupportedCurrency;
  due_day: number | null;
}

const toExpense = (r: ExpenseRow): PlannedExpense => ({
  id: r.id,
  name: r.name,
  amount: Number(r.amount),
  currency: r.currency,
  dueDay: r.due_day,
});

export async function listPlannedExpenses(userId: number): Promise<PlannedExpense[]> {
  const res = await pool.query<ExpenseRow>("SELECT * FROM planned_expenses WHERE user_id=$1 ORDER BY id", [
    userId,
  ]);
  return res.rows.map(toExpense);
}

export async function createPlannedExpense(
  userId: number,
  e: Omit<PlannedExpense, "id">,
): Promise<PlannedExpense> {
  const res = await pool.query<ExpenseRow>(
    "INSERT INTO planned_expenses(user_id,name,amount,currency,due_day) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [userId, e.name, e.amount, e.currency, e.dueDay],
  );
  return toExpense(res.rows[0]);
}

export async function deletePlannedExpense(userId: number, id: number): Promise<boolean> {
  const res = await pool.query("DELETE FROM planned_expenses WHERE id=$1 AND user_id=$2", [id, userId]);
  return (res.rowCount ?? 0) > 0;
}
