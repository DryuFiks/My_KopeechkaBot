import { Bot, InputFile } from "grammy";
import { pool } from "../db";
import { mainKeyboard } from "../keyboards";
import { escapeHtml, formatMoney, formatPeriodLabel, renderScreen, PARSE_MODE } from "../format";
import { monthStart, showBudget } from "./common";
import { safe } from "../middleware/safe";

export function registerAnalyticsHandlers(bot: Bot): void {
  bot.command(
    "budget",
    safe("budget", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const m = /^\/budget\s+(.+?)\s+(\d+(?:[.,]\d{1,2})?)\s*$/.exec(ctx.message?.text ?? "");
      if (m) {
        const cat = m[1].trim(),
          limit = Number(m[2].replace(",", "."));
        if (!cat || limit <= 0) {
          await ctx.reply("Формат: /budget Категория сумма");
          return;
        }
        const d = monthStart();
        await pool.query(
          `INSERT INTO budgets(user_id,month,category,limit_gel) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,month,category) DO UPDATE SET limit_gel=EXCLUDED.limit_gel`,
          [uid, d, cat, limit],
        );
        await ctx.reply(`Лимит для «${escapeHtml(cat)}»: ${formatMoney(limit, "GEL")}`, {
          parse_mode: PARSE_MODE,
          reply_markup: mainKeyboard,
        });
        return;
      }
      await showBudget(ctx, uid);
    }),
  );

  bot.command(
    "stats",
    safe("stats", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const from = monthStart();
      const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
      const r = await pool.query(
        `SELECT category,COALESCE(SUM(amount_gel),0) total FROM transactions WHERE user_id=$1 AND type='expense' AND created_at >= $2 AND created_at < $3 GROUP BY category ORDER BY total DESC LIMIT 10`,
        [uid, from, to],
      );
      const text = renderScreen({
        title: `Расходы по категориям — ${formatPeriodLabel(from, to)}`,
        lines: r.rows.map(
          (x: any) => `${escapeHtml(x.category ?? "Без категории")}: ${formatMoney(x.total, "GEL")}`,
        ),
        emptyText: "За этот месяц расходов нет.",
      });
      await ctx.reply(text, { parse_mode: PARSE_MODE, reply_markup: mainKeyboard });
    }),
  );

  bot.command(
    "export",
    safe("export", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const r = await pool.query(
        "SELECT created_at,type,amount,currency,category,note,amount_gel FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5000",
        [uid],
      );
      const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = [
        "date,type,amount,currency,category,note,amount_gel",
        ...r.rows.map((x: any) =>
          [x.created_at.toISOString(), x.type, x.amount, x.currency, x.category, x.note, x.amount_gel]
            .map(q)
            .join(","),
        ),
      ].join("\r\n");
      await ctx.replyWithDocument(new InputFile(Buffer.from("\uFEFF" + csv, "utf8"), "transactions.csv"), {
        caption: "Экспорт последних 5000 операций (CSV)",
      });
    }),
  );
}
