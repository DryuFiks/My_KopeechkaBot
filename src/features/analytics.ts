import { Bot, InputFile } from "grammy";
import { pool } from "../db";
import { mainKeyboard } from "../keyboards";
import { escapeHtml, formatMoney, PARSE_MODE } from "../format";
import { monthStart, showBudget } from "./common";
import { renderStatsScreen } from "./stats";
import { safe } from "../middleware/safe";

export function registerAnalyticsHandlers(bot: Bot): void {
  bot.command(
    "budget",
    safe("budget", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;

      const rolloverMatch = /^\/budget\s+rollover\s+(.+?)\s+(on|off)\s*$/i.exec(ctx.message?.text ?? "");
      if (rolloverMatch) {
        const cat = rolloverMatch[1].trim();
        const enabled = rolloverMatch[2].toLowerCase() === "on";
        const r = await pool.query(
          "UPDATE budgets SET rollover=$4 WHERE user_id=$1 AND month=$2 AND category=$3 RETURNING category",
          [uid, monthStart(), cat, enabled],
        );
        if (!r.rowCount) {
          await ctx.reply(`Сначала задай лимит: /budget ${cat} сумма`, { reply_markup: mainKeyboard });
          return;
        }
        await ctx.reply(
          `Перенос остатка для «${escapeHtml(cat)}»: ${enabled ? "включён" : "выключен"}. Учитывается только положительный остаток предыдущего месяца — перерасход на этот месяц не переносится.`,
          { parse_mode: PARSE_MODE, reply_markup: mainKeyboard },
        );
        return;
      }

      const m = /^\/budget\s+(.+?)\s+(\d+(?:[.,]\d{1,2})?)\s*$/.exec(ctx.message?.text ?? "");
      if (m) {
        const cat = m[1].trim(),
          limit = Number(m[2].replace(",", "."));
        if (!cat || limit <= 0) {
          await ctx.reply("Формат: /budget Категория сумма", { reply_markup: mainKeyboard });
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
      const { text, keyboard } = await renderStatsScreen(uid, 0);
      await ctx.reply(text, { parse_mode: PARSE_MODE, reply_markup: keyboard });
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
        reply_markup: mainKeyboard,
      });
    }),
  );
}
