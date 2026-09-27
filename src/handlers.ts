import { Bot, Context, InputFile } from "grammy";
import { parseTransactionMessage, isParseError } from "./parser";
import { convertToGel, getAllRateInfo, refreshRatesIfStale } from "./currency";
import {
  insertTransaction,
  getLastTransactions,
  getSummaryForRange,
  deleteLastTransaction,
  Transaction,
  PeriodSummary,
} from "./db";
import { escapeHtml, PARSE_MODE } from "./format";
import { logger } from "./logger";
import { addRecurring, listRecurring, removeRecurring, toggleRecurring, RecurringPeriod } from "./recurring";
import { pool } from "./db";

const HELP_MESSAGE = `<b>Как записать операцию</b> — одной строкой:
<code>-150 rub еда обед</code>   (расход 150 RUB, категория "еда", заметка "обед")
<code>-20 gel транспорт</code>   (расход 20 GEL)
<code>+2000 gel фриланс</code>   (доход 2000 GEL)
<code>-12.50 usd подписка</code>
<code>-150 еда обед</code>       (валюта по умолчанию — GEL)

Знак: "-" — расход, "+" — доход.
Валюты: RUB, GEL, USD.
Если валюта не указана явно, используется GEL.
Если сумму не удалось распознать или валюта неизвестна — операция не сохраняется.

<b>Команды</b>
/start — приветствие и краткая справка
/help — эта справка
/today — сводка за сегодня
/month — доходы, расходы и баланс за текущий месяц
/last — последние 10 операций
/undo — отменить последнюю операцию
/rate — используемые курсы валют и когда они обновлялись
/stats — топ-5 категорий расходов за месяц
/export — выгрузить операции в CSV
/recurring — управление регулярными платежами
Пример: /recurring add expense 12.50 GEL подписка monthly 2026-10-01`;

const START_MESSAGE = `Привет! Я — бот для учёта доходов и расходов.\n\n${HELP_MESSAGE}`;

function formatTx(tx: Transaction): string {
  const sign = tx.type === "expense" ? "-" : "+";
  const gel = tx.amount_gel !== null ? `≈ ${tx.amount_gel} GEL` : "курс недоступен";
  const cat = tx.category ? ` [${escapeHtml(tx.category)}]` : "";
  const note = tx.note ? ` — ${escapeHtml(tx.note)}` : "";
  const date = tx.created_at.toISOString().slice(0, 16).replace("T", " ");
  return `${escapeHtml(date)}  ${sign}${tx.amount} ${tx.currency}${cat}${note}  (${gel})`;
}

function formatSummary(title: string, summary: PeriodSummary): string {
  const unconvertedNote =
    summary.unconverted_count > 0
      ? `\n⚠️ ${summary.unconverted_count} операц. без курса — не учтены в сумме`
      : "";
  return (
    `<b>${title}</b>\n` +
    `Доходы: +${summary.income_gel} GEL\n` +
    `Расходы: -${summary.expense_gel} GEL\n` +
    `Баланс: ${summary.balance_gel} GEL\n` +
    `Операций: ${summary.operation_count}${unconvertedNote}`
  );
}

// A short, safe message shown to the user for unexpected (non-input) errors.
// Never includes stack traces, SQL, or connection strings.
const GENERIC_ERROR_MESSAGE = "Что-то пошло не так. Попробуй ещё раз чуть позже.";

/** Wraps a handler so an unexpected error is logged with context and never leaks details to the user. */
function safe<C extends Context>(label: string, fn: (ctx: C) => Promise<void>): (ctx: C) => Promise<void> {
  return async (ctx) => {
    try {
      await fn(ctx);
    } catch (err) {
      logger.error(`${label} failed: ${(err as Error).message}`);
      await ctx.reply(GENERIC_ERROR_MESSAGE).catch(() => {
        // If even the error reply fails (e.g. Telegram API hiccup), there's
        // nothing more we can safely do here — already logged above.
      });
    }
  };
}

export function registerHandlers(bot: Bot): void {
  bot.command(
    "start",
    safe("/start", async (ctx) => {
      await ctx.reply(START_MESSAGE, { parse_mode: PARSE_MODE });
    })
  );

  bot.command(
    "help",
    safe("/help", async (ctx) => {
      await ctx.reply(HELP_MESSAGE, { parse_mode: PARSE_MODE });
    })
  );

  bot.command(
    "rate",
    safe("/rate", async (ctx) => {
      await refreshRatesIfStale();
      const rates = getAllRateInfo();
      const lines = rates.map((r) => {
        if (r.rateToGel === null) {
          return `${r.currency} → курс недоступен`;
        }
        const staleTag = r.isFallback ? " ⚠️ устаревший (API недоступен)" : "";
        const updated = r.updatedAt
          ? ` (обновлено ${r.updatedAt.toISOString().slice(0, 16).replace("T", " ")})`
          : "";
        return `${r.currency} → ${r.rateToGel} GEL${updated}${staleTag}`;
      });
      await ctx.reply(`Текущие курсы (источник: Нацбанк Грузии, NBG):\n${lines.join("\n")}`);
    })
  );

  bot.command(
    "today",
    safe("/today", async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      const summary = await getSummaryForRange(userId, from, to);
      await ctx.reply(formatSummary("Итоги за сегодня", summary), { parse_mode: PARSE_MODE });
    })
  );

  bot.command(
    "month",
    safe("/month", async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const summary = await getSummaryForRange(userId, from, to);
      await ctx.reply(formatSummary("Итоги за месяц", summary), { parse_mode: PARSE_MODE });
    })
  );

  bot.command(
    "last",
    safe("/last", async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      const txs = await getLastTransactions(userId, 10);
      if (txs.length === 0) {
        await ctx.reply("Операций пока нет. Отправь первую, например: -20 gel транспорт");
        return;
      }
      const lines = txs.map(formatTx);
      await ctx.reply(`<b>Последние операции</b>\n${lines.join("\n")}`, {
        parse_mode: PARSE_MODE,
      });
    })
  );

  bot.command(
    "undo",
    safe("/undo", async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      const deleted = await deleteLastTransaction(userId);
      if (!deleted) {
        await ctx.reply("Нечего отменять — операций нет.");
        return;
      }
      await ctx.reply(`Отменено: ${formatTx(deleted)}`, { parse_mode: PARSE_MODE });
    })
  );


  bot.command("stats", safe("/stats", async (ctx) => {
    const userId = ctx.from?.id; if (!userId) return;
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const result = await pool.query<{category:string|null; total:string; count:string}>(
      `SELECT COALESCE(category,'Без категории') AS category,
              COALESCE(SUM(amount_gel),0) AS total, COUNT(*) AS count
       FROM transactions WHERE user_id=$1 AND type='expense'
         AND created_at >= $2 AND created_at < $3 AND amount_gel IS NOT NULL
       GROUP BY category ORDER BY SUM(amount_gel) DESC NULLS LAST LIMIT 5`,
      [userId,from,to]);
    if (!result.rows.length) { await ctx.reply("В этом месяце пока нет расходов с доступным курсом."); return; }
    const lines=result.rows.map((r,i)=>`${i+1}. ${escapeHtml(r.category??"Без категории")} — ${Number(r.total).toFixed(2)} GEL (${r.count} оп.)`);
    await ctx.reply(`<b>Топ-5 категорий расходов за месяц</b>\n${lines.join("\n")}`,{parse_mode:PARSE_MODE});
  }));

  bot.command("export", safe("/export", async (ctx) => {
    const userId=ctx.from?.id; if(!userId) return;
    const result=await pool.query<Transaction>(
      `SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at,id`,[userId]);
    const fields=["id","created_at","type","amount","currency","amount_gel","category","note"];
    const csvCell=(v:unknown)=>{ const value=v instanceof Date?v.toISOString():String(v??""); return `"${value.replace(/"/g,'""')}"`; };
    const csv=[fields.join(","),...result.rows.map(row=>fields.map(k=>csvCell((row as unknown as Record<string,unknown>)[k])).join(","))].join("\r\n");
    await ctx.replyWithDocument(new InputFile(Buffer.from("\uFEFF"+csv,"utf8"),"finance-export.csv"),{caption:`Экспортировано операций: ${result.rows.length}`});
  }));

  bot.command("recurring", safe("/recurring", async (ctx) => {
    const userId=ctx.from?.id; if(!userId) return;
    const args=(ctx.match??"").trim().split(/\s+/).filter(Boolean);
    const usage="Команды:\n/recurring list\n/recurring add <expense|income> <сумма> <RUB|GEL|USD> <категория> <daily|weekly|monthly> <YYYY-MM-DD>\n/recurring remove <id>\n/recurring toggle <id>";
    if(!args.length || args[0]==="help"){await ctx.reply(usage);return;}
    if(args[0]==="list"){
      const rows=await listRecurring(userId);
      if(!rows.length){await ctx.reply("Регулярных платежей пока нет.");return;}
      await ctx.reply("<b>Регулярные платежи</b>\n"+rows.map(r=>`#${r.id} ${r.is_active?"🟢":"⏸"} ${r.type==="expense"?"−":"+"}${r.amount} ${r.currency} ${escapeHtml(r.category??"без категории")} — ${r.period}, следующее: ${r.next_run_at.toISOString().slice(0,10)}`).join("\n"),{parse_mode:PARSE_MODE});return;
    }
    if(args[0]==="remove"||args[0]==="toggle"){
      const id=Number(args[1]); if(!Number.isInteger(id)||id<1){await ctx.reply("Укажи корректный ID.");return;}
      const ok=args[0]==="remove"?await removeRecurring(userId,id):await toggleRecurring(userId,id);
      await ctx.reply(ok?(args[0]==="remove"?"Платёж удалён.":"Статус платежа изменён."):"Платёж не найден.");return;
    }
    if(args[0]==="add"){
      const [,type,amountRaw,currencyRaw,category,periodRaw,dateRaw]=args;
      const amount=Number(amountRaw), currency=(currencyRaw??"").toUpperCase();
      const period=periodRaw as RecurringPeriod;
      const date=/^\d{4}-\d{2}-\d{2}$/.test(dateRaw??"")?new Date(`${dateRaw}T09:00:00.000Z`):new Date(NaN);
      if(!["expense","income"].includes(type)||!Number.isFinite(amount)||amount<=0||
        !["RUB","GEL","USD"].includes(currency)||!["daily","weekly","monthly"].includes(period)||
        Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==dateRaw){
        await ctx.reply("Некорректные параметры.\n"+usage);return;
      }
      const row=await addRecurring({userId,type:type as "expense"|"income",amount,currency:currency as "RUB"|"GEL"|"USD",category:category??null,note:null,period,nextRun:date});
      await ctx.reply(`Регулярный платёж #${row.id} создан. Первое выполнение: ${dateRaw}.`);return;
    }
    await ctx.reply(usage);
  }));

  // Plain text messages — attempt to parse as a transaction.
  bot.on("message:text", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const text = ctx.message.text;
    if (text.startsWith("/")) return; // unknown command — grammY already routed known ones

    const result = parseTransactionMessage(text);
    if (isParseError(result)) {
      await ctx.reply(result.error);
      return;
    }

    try {
      await refreshRatesIfStale();
      const amountGel = convertToGel(result.amount, result.currency);

      const saved = await insertTransaction({
        userId,
        type: result.type,
        amount: result.amount,
        currency: result.currency,
        amountGel,
        category: result.category,
        note: result.note,
      });

      const sign = saved.type === "expense" ? "Расход" : "Доход";
      const gelText =
        saved.amount_gel !== null ? `≈ ${saved.amount_gel} GEL` : "курс для этой валюты недоступен";
      const categoryText = saved.category ? `, категория: ${escapeHtml(saved.category)}` : "";
      await ctx.reply(`${sign} записан: ${saved.amount} ${saved.currency}${categoryText} (${gelText})`, {
        parse_mode: PARSE_MODE,
      });
    } catch (err) {
      logger.error(`message:text (insert) failed: ${(err as Error).message}`);
      await ctx.reply(GENERIC_ERROR_MESSAGE).catch(() => {});
    }
  });

  bot.catch((err) => {
    logger.error(`Unhandled bot error: ${err.message}`);
  });
}
