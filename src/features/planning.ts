import { Bot } from "grammy";
import { pool } from "../db";
import { mainKeyboard } from "../keyboards";
import { escapeHtml, PARSE_MODE } from "../format";
import { safe } from "../middleware/safe";

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
}
