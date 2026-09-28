import { Bot } from "grammy";
import { pool } from "../db";
import { confirmActionKeyboard, mainKeyboard } from "../keyboards";
import { escapeHtml, formatMoney, renderScreen, PARSE_MODE } from "../format";
import { safe, safeCallback } from "../middleware/safe";

const CATEGORY_KIND_LABEL: Record<string, string> = {
  recurring: "обязательный платёж",
  variable: "повседневный",
  irregular: "нерегулярный/крупный",
};

export function registerPlanningHandlers(bot: Bot): void {
  bot.command(
    "category",
    safe("category", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const usage = "Формат: /category expense Еда [recurring|variable|irregular]";
      const m = /^\/category\s+(expense|income)\s+(.+)$/i.exec(ctx.message?.text ?? "");
      if (!m) {
        await ctx.reply(usage, { reply_markup: mainKeyboard });
        return;
      }
      const type = m[1].toLowerCase();
      let rest = m[2].trim();
      let kind = "variable";
      const kindMatch = /^(.*?)\s+(recurring|variable|irregular)$/i.exec(rest);
      if (kindMatch) {
        rest = kindMatch[1].trim();
        kind = kindMatch[2].toLowerCase();
      }
      const name = rest.slice(0, 60);
      if (!name) {
        await ctx.reply(usage, { reply_markup: mainKeyboard });
        return;
      }
      await pool.query(
        `INSERT INTO categories(user_id,type,name,kind) VALUES($1,$2,$3,$4)
         ON CONFLICT (user_id,type,name) DO UPDATE SET kind=EXCLUDED.kind`,
        [uid, type, name, kind],
      );
      await ctx.reply(`Категория добавлена: ${escapeHtml(name)} (${CATEGORY_KIND_LABEL[kind]})`, {
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
        const text = renderScreen({
          title: "Цели накопления",
          lines: r.rows.map(
            (x: any) =>
              `${x.id}. ${escapeHtml(x.title)} — ${formatMoney(x.saved_gel, "GEL")} / ${formatMoney(x.target_gel, "GEL")}`,
          ),
          emptyText: "Целей пока нет. Создай: /goal Название сумма",
        });
        await ctx.reply(text, { parse_mode: PARSE_MODE, reply_markup: mainKeyboard });
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
        await ctx.reply("Формат: /save ID_цели сумма", { reply_markup: mainKeyboard });
        return;
      }
      const r = await pool.query(
        "UPDATE savings_goals SET saved_gel=saved_gel+$3 WHERE id=$1 AND user_id=$2 AND active RETURNING title,saved_gel,target_gel",
        [Number(m[1]), uid, Number(m[2].replace(",", "."))],
      );
      if (!r.rowCount) {
        await ctx.reply("Цель не найдена.", { reply_markup: mainKeyboard });
        return;
      }
      const x = r.rows[0];
      await ctx.reply(
        `${escapeHtml(x.title)}: ${formatMoney(x.saved_gel, "GEL")} / ${formatMoney(x.target_gel, "GEL")}`,
        { parse_mode: PARSE_MODE, reply_markup: mainKeyboard },
      );
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
        const text = renderScreen({
          title: "Регулярные платежи",
          lines: r.rows.map(
            (x: any) =>
              `${x.id}. ${escapeHtml(x.title)} — ${formatMoney(x.amount, x.currency)}, день ${x.due_day}`,
          ),
          emptyText: "Платежей пока нет. Создание: /payment день сумма валюта название",
        });
        await ctx.reply(text, { parse_mode: PARSE_MODE, reply_markup: mainKeyboard });
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
      const text = renderScreen({
        title: "Регулярные платежи",
        lines: r.rows.map(
          (x: any) =>
            `${x.id}. ${escapeHtml(x.title)} — ${formatMoney(x.amount, x.currency)}, день ${x.due_day}`,
        ),
        emptyText: "Регулярных платежей нет.",
      });
      await ctx.reply(text, { parse_mode: PARSE_MODE, reply_markup: mainKeyboard });
    }),
  );

  bot.command(
    "deletepayment",
    safe("deletepayment", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const id = Number((ctx.message?.text ?? "").split(/\s+/)[1]);
      if (!Number.isInteger(id) || id < 1) {
        await ctx.reply("Формат: /deletepayment ID", { reply_markup: mainKeyboard });
        return;
      }
      const r = await pool.query(
        "SELECT title FROM recurring_payments WHERE id=$1 AND user_id=$2 AND active",
        [id, uid],
      );
      if (!r.rowCount) {
        await ctx.reply("Платёж не найден.", { reply_markup: mainKeyboard });
        return;
      }
      await ctx.reply(`Отключить платёж «${escapeHtml(r.rows[0].title)}»?`, {
        parse_mode: PARSE_MODE,
        reply_markup: confirmActionKeyboard(`delpay:${id}:yes`, `delpay:${id}:no`),
      });
    }),
  );

  bot.callbackQuery(
    /^delpay:(\d+):(yes|no)$/,
    safeCallback("deletepayment confirm", async (ctx) => {
      if (ctx.match[2] === "no") {
        await ctx.answerCallbackQuery({ text: "Отменено" });
        await ctx.editMessageText("Действие отменено.", { reply_markup: mainKeyboard }).catch(() => {});
        return;
      }
      const uid = ctx.from?.id;
      const r = uid
        ? await pool.query(
            "UPDATE recurring_payments SET active=FALSE WHERE id=$1 AND user_id=$2 AND active RETURNING id",
            [Number(ctx.match[1]), uid],
          )
        : null;
      await ctx.answerCallbackQuery({ text: r?.rowCount ? "Платёж отключён" : "Уже отключён" });
      await ctx
        .editMessageText(r?.rowCount ? "Платёж отключён." : "Платёж уже отключён или не найден.", {
          reply_markup: mainKeyboard,
        })
        .catch(() => {});
    }),
  );

  bot.command(
    "deletegoal",
    safe("deletegoal", async (ctx) => {
      const uid = ctx.from?.id;
      if (!uid) return;
      const id = Number((ctx.message?.text ?? "").split(/\s+/)[1]);
      const r = await pool.query("SELECT title FROM savings_goals WHERE id=$1 AND user_id=$2 AND active", [
        id,
        uid,
      ]);
      if (!r.rowCount) {
        await ctx.reply("Цель не найдена.", { reply_markup: mainKeyboard });
        return;
      }
      await ctx.reply(`Закрыть цель «${escapeHtml(r.rows[0].title)}»?`, {
        parse_mode: PARSE_MODE,
        reply_markup: confirmActionKeyboard(`delgoal:${id}:yes`, `delgoal:${id}:no`),
      });
    }),
  );

  bot.callbackQuery(
    /^delgoal:(\d+):(yes|no)$/,
    safeCallback("deletegoal confirm", async (ctx) => {
      if (ctx.match[2] === "no") {
        await ctx.answerCallbackQuery({ text: "Отменено" });
        await ctx.editMessageText("Действие отменено.", { reply_markup: mainKeyboard }).catch(() => {});
        return;
      }
      const uid = ctx.from?.id;
      const r = uid
        ? await pool.query(
            "UPDATE savings_goals SET active=FALSE WHERE id=$1 AND user_id=$2 AND active RETURNING id",
            [Number(ctx.match[1]), uid],
          )
        : null;
      await ctx.answerCallbackQuery({ text: r?.rowCount ? "Цель закрыта" : "Уже закрыта" });
      await ctx
        .editMessageText(r?.rowCount ? "Цель закрыта." : "Цель уже закрыта или не найдена.", {
          reply_markup: mainKeyboard,
        })
        .catch(() => {});
    }),
  );
}
