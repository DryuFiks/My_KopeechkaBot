import { Bot } from "grammy";
import { pool } from "../db";
import { mainKeyboard } from "../keyboards";
import { escapeHtml, PARSE_MODE } from "../format";
import { money } from "./common";
import { safe } from "../middleware/safe";

export function registerPlanningHandlers(bot: Bot): void {
  bot.command(
    "category",
    safe("category", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const m = /^\/category\s+(expense|income)\s+(.+)$/i.exec(ctx.message?.text ?? "");
      if (!m) {
        await ctx.reply("Формат: /category expense Еда или /category income Зарплата");
        return;
      }
      const name = m[2].trim().slice(0, 60);
      await pool.query("INSERT INTO categories(user_id,type,name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [
        uid,
        m[1].toLowerCase(),
        name,
      ]);
      await ctx.reply(`Категория добавлена: ${escapeHtml(name)}`, {
        parse_mode: PARSE_MODE,
        reply_markup: mainKeyboard,
      });
    }),
  );

  bot.command(
    "goal",
    safe("goal", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const m = /^\/goal\s+(.+?)\s+(\d+(?:[.,]\d{1,2})?)\s*$/.exec(ctx.message?.text ?? "");
      if (!m) {
        const r = await pool.query(
          "SELECT id,title,saved_gel,target_gel FROM savings_goals WHERE user_id=$1 AND active ORDER BY id",
          [uid],
        );
        await ctx.reply(
          r.rowCount
            ? r.rows
                .map(
                  (x: any) =>
                    `${x.id}. ${escapeHtml(x.title)} — ${money(x.saved_gel)} / ${money(x.target_gel)} GEL`,
                )
                .join("\n")
            : "Целей пока нет. Создай: /goal Название сумма",
          { parse_mode: PARSE_MODE, reply_markup: mainKeyboard },
        );
        return;
      }
      await pool.query("INSERT INTO savings_goals(user_id,title,target_gel) VALUES($1,$2,$3)", [
        uid,
        m[1].trim().slice(0, 120),
        Number(m[2].replace(",", ".")),
      ]);
      await ctx.reply("Цель накопления создана.", { reply_markup: mainKeyboard });
    }),
  );

  bot.command(
    "save",
    safe("save", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const m = /^\/save\s+(\d+)\s+(\d+(?:[.,]\d{1,2})?)\s*$/.exec(ctx.message?.text ?? "");
      if (!m) {
        await ctx.reply("Формат: /save ID_цели сумма");
        return;
      }
      const r = await pool.query(
        "UPDATE savings_goals SET saved_gel=saved_gel+$3 WHERE id=$1 AND user_id=$2 AND active RETURNING title,saved_gel,target_gel",
        [Number(m[1]), uid, Number(m[2].replace(",", "."))],
      );
      if (!r.rowCount) {
        await ctx.reply("Цель не найдена.");
        return;
      }
      const x = r.rows[0];
      await ctx.reply(`${escapeHtml(x.title)}: ${money(x.saved_gel)} / ${money(x.target_gel)} GEL`, {
        parse_mode: PARSE_MODE,
        reply_markup: mainKeyboard,
      });
    }),
  );

  bot.command(
    "payment",
    safe("payment", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const m = /^\/payment\s+(\d{1,2})\s+(\d+(?:[.,]\d{1,2})?)\s+(RUB|GEL|USD)\s+(.+)$/i.exec(
        ctx.message?.text ?? "",
      );
      if (!m) {
        const r = await pool.query(
          "SELECT id,title,amount,currency,due_day FROM recurring_payments WHERE user_id=$1 AND active ORDER BY due_day",
          [uid],
        );
        await ctx.reply(
          r.rowCount
            ? r.rows
                .map(
                  (x: any) =>
                    `${x.id}. ${escapeHtml(x.title)} — ${x.amount} ${x.currency}, день ${x.due_day}`,
                )
                .join("\n")
            : "Платежей пока нет. Создание: /payment день сумма валюта название",
          { parse_mode: PARSE_MODE, reply_markup: mainKeyboard },
        );
        return;
      }
      await pool.query(
        "INSERT INTO recurring_payments(user_id,due_day,amount,currency,title) VALUES($1,$2,$3,$4,$5)",
        [uid, Number(m[1]), Number(m[2].replace(",", ".")), m[3].toUpperCase(), m[4].trim().slice(0, 120)],
      );
      await ctx.reply("Регулярный платёж добавлен.", { reply_markup: mainKeyboard });
    }),
  );

  bot.command(
    "payments",
    safe("payments", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const r = await pool.query(
        "SELECT id,title,amount,currency,due_day FROM recurring_payments WHERE user_id=$1 AND active ORDER BY due_day",
        [uid],
      );
      await ctx.reply(
        r.rowCount
          ? r.rows
              .map(
                (x: any) => `${x.id}. ${escapeHtml(x.title)} — ${x.amount} ${x.currency}, день ${x.due_day}`,
              )
              .join("\n")
          : "Регулярных платежей нет.",
        { parse_mode: PARSE_MODE, reply_markup: mainKeyboard },
      );
    }),
  );

  bot.command(
    "deletepayment",
    safe("deletepayment", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const id = Number((ctx.message?.text ?? "").split(/\s+/)[1]);
      if (!Number.isInteger(id) || id < 1) {
        await ctx.reply("Формат: /deletepayment ID");
        return;
      }
      const r = await pool.query(
        "UPDATE recurring_payments SET active=FALSE WHERE id=$1 AND user_id=$2 RETURNING id",
        [id, uid],
      );
      await ctx.reply(r.rowCount ? "Платёж отключён." : "Платёж не найден.", { reply_markup: mainKeyboard });
    }),
  );

  bot.command(
    "deletegoal",
    safe("deletegoal", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const id = Number((ctx.message?.text ?? "").split(/\s+/)[1]);
      const r = await pool.query(
        "UPDATE savings_goals SET active=FALSE WHERE id=$1 AND user_id=$2 RETURNING id",
        [id, uid],
      );
      await ctx.reply(r.rowCount ? "Цель закрыта." : "Цель не найдена.", { reply_markup: mainKeyboard });
    }),
  );
}
