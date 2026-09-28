import { pool } from "../db";

export interface SavingsGoal {
  id: number;
  user_id: string;
  title: string;
  target_gel: string;
  saved_gel: string;
  target_date: Date | null;
  active: boolean;
  created_at: Date;
}

export async function listGoals(userId: number): Promise<SavingsGoal[]> {
  const result = await pool.query<SavingsGoal>(
    "SELECT * FROM savings_goals WHERE user_id=$1 AND active ORDER BY id",
    [userId],
  );
  return result.rows;
}

export async function createGoal(
  userId: number,
  title: string,
  targetGel: number,
  targetDate: string | null,
): Promise<SavingsGoal> {
  const result = await pool.query<SavingsGoal>(
    "INSERT INTO savings_goals(user_id,title,target_gel,target_date) VALUES($1,$2,$3,$4) RETURNING *",
    [userId, title, targetGel, targetDate],
  );
  return result.rows[0];
}

export async function findGoal(userId: number, id: number): Promise<SavingsGoal | null> {
  const result = await pool.query<SavingsGoal>(
    "SELECT * FROM savings_goals WHERE id=$1 AND user_id=$2 AND active",
    [id, userId],
  );
  return result.rows[0] ?? null;
}

export async function contributeToGoal(
  userId: number,
  id: number,
  amountGel: number,
): Promise<SavingsGoal | null> {
  const result = await pool.query<SavingsGoal>(
    "UPDATE savings_goals SET saved_gel=saved_gel+$3 WHERE id=$1 AND user_id=$2 AND active RETURNING *",
    [id, userId, amountGel],
  );
  return result.rows[0] ?? null;
}

export async function closeGoal(userId: number, id: number): Promise<SavingsGoal | null> {
  const result = await pool.query<SavingsGoal>(
    "UPDATE savings_goals SET active=FALSE WHERE id=$1 AND user_id=$2 AND active RETURNING *",
    [id, userId],
  );
  return result.rows[0] ?? null;
}
