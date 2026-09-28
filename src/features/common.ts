import { Context } from "grammy";
import { pool } from "../db";
import { mainKeyboard } from "../keyboards";
import { escapeHtml, formatMoney, formatPeriodLabel, renderScreen, PARSE_MODE } from "../format";
import type { TransactionType } from "../parser";

export type Flow = {
  type: TransactionType;
  amount?: number;
  currency?: "RUB" | "GEL" | "USD";
  category?: string | null;
  note?: string | null;
  stage: "amount" | "category" | "confirm";
};

export const flows = new Map<number, Flow>();
export const money = (n: unknown) => Number(n ?? 0).toFixed(2);
export const monthStart = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

export async function showBudget(ctx: Context, userId: number): Promise<void> {
  const from = monthStart();
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const result = await pool.query(
    `SELECT b.category,b.limit_gel,COALESCE(SUM(t.amount_gel),0) spent
     FROM budgets b
     LEFT JOIN transactions t ON t.user_id=b.user_id AND t.type='expense'
       AND t.category=b.category AND t.created_at >= $2 AND t.created_at < $3
     WHERE b.user_id=$1 AND b.month=$2
     GROUP BY b.id ORDER BY b.category`,
    [userId, from, to],
  );
  const lines = result.rows.map((row: any) => {
    const spent = Number(row.spent);
    const limit = Number(row.limit_gel);
    return `${escapeHtml(row.category)}: ${formatMoney(spent, "GEL")} / ${formatMoney(limit, "GEL")}${spent > limit ? " ⚠️" : ""}`;
  });
  const text = renderScreen({
    title: `Бюджет — ${formatPeriodLabel(from, to)}`,
    lines,
    emptyText: "На этот месяц лимиты не заданы. Пришли: /budget Категория сумма (например: /budget Еда 500)",
  });
  await ctx.reply(text, { parse_mode: PARSE_MODE, reply_markup: mainKeyboard });
}
