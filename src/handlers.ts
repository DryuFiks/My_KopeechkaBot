import { Bot } from "grammy";
import { parseTransactionMessage, isParseError } from "./parser";
import { convertToGel, getRates } from "./currency";
import {
  insertTransaction,
  getLastTransactions,
  getMonthlySummary,
  deleteLastTransaction,
  Transaction,
} from "./db";

const START_MESSAGE = `Привет! Я — бот для учёта доходов и расходов.

Как записать операцию — одной строкой:
  -150 rub еда обед   (расход 150 RUB, категория "еда", заметка "обед")
  -20 gel транспорт   (расход 20 GEL)
  +2000 gel фриланс   (доход 2000 GEL)
  -12.50 usd подписка
  -150 еда обед        (валюта по умолчанию — GEL)

Знак: "-" — расход, "+" — доход.
Валюты: RUB, GEL, USD.

Команды:
/month — доходы, расходы и баланс за текущий месяц
/last — последние 10 операций
/undo — отменить последнюю операцию
/rate — используемые курсы валют`;

function formatTx(tx: Transaction): string {
  const sign = tx.type === "expense" ? "-" : "+";
  const gel =
    tx.amount_gel !== null ? `≈ ${tx.amount_gel} GEL` : "курс недоступен";
  const cat = tx.category ? ` [${tx.category}]` : "";
  const note = tx.note ? ` — ${tx.note}` : "";
  const date = tx.created_at.toISOString().slice(0, 16).replace("T", " ");
  return `${date}  ${sign}${tx.amount} ${tx.currency}${cat}${note}  (${gel})`;
}

export function registerHandlers(bot: Bot): void {
  bot.command("start", async (ctx) => {
    await ctx.reply(START_MESSAGE);
  });

  bot.command("rate", async (ctx) => {
    const rates = getRates();
    const lines = rates.map((r) => `${r.currency} → ${r.rateToGel} GEL`);
    await ctx.reply(
      `Текущие курсы (тестовые, захардкожены):\n${lines.join("\n")}`
    );
  });

  bot.command("month", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    try {
      const summary = await getMonthlySummary(userId, from, to);
      const unconvertedNote =
        summary.unconverted_count > 0
          ? `\n⚠️ ${summary.unconverted_count} операц. без курса — не учтены в сумме`
          : "";
      await ctx.reply(
        `Итоги за месяц:\n` +
          `Доходы: +${summary.income_gel} GEL\n` +
          `Расходы: -${summary.expense_gel} GEL\n` +
          `Баланс: ${summary.balance_gel} GEL\n` +
          `Операций: ${summary.operation_count}${unconvertedNote}`
      );
    } catch (err) {
      console.error(`[handlers] /month failed: ${(err as Error).message}`);
      await ctx.reply("Не удалось получить сводку за месяц. Попробуй позже.");
    }
  });

  bot.command("last", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      const txs = await getLastTransactions(userId, 10);
      if (txs.length === 0) {
        await ctx.reply("Операций пока нет. Отправь первую, например: -20 gel транспорт");
        return;
      }
      const lines = txs.map(formatTx);
      await ctx.reply(`Последние операции:\n${lines.join("\n")}`);
    } catch (err) {
      console.error(`[handlers] /last failed: ${(err as Error).message}`);
      await ctx.reply("Не удалось получить список операций. Попробуй позже.");
    }
  });

  bot.command("undo", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      const deleted = await deleteLastTransaction(userId);
      if (!deleted) {
        await ctx.reply("Нечего отменять — операций нет.");
        return;
      }
      await ctx.reply(`Отменено: ${formatTx(deleted)}`);
    } catch (err) {
      console.error(`[handlers] /undo failed: ${(err as Error).message}`);
      await ctx.reply("Не удалось отменить операцию. Попробуй позже.");
    }
  });

  // Plain text messages — attempt to parse as a transaction.
  bot.on("message:text", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const text = ctx.message.text;
    if (text.startsWith("/")) return; // unknown command, ignore here

    const result = parseTransactionMessage(text);
    if (isParseError(result)) {
      await ctx.reply(result.error);
      return;
    }

    let amountGel: number | null = null;
    try {
      amountGel = convertToGel(result.amount, result.currency);
    } catch (err) {
      // Unknown currency slipped through — should not happen since the
      // parser already validates, but never silently store a fake value.
      amountGel = null;
    }

    try {
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
        saved.amount_gel !== null
          ? `≈ ${saved.amount_gel} GEL`
          : "курс для этой валюты недоступен";
      await ctx.reply(
        `${sign} записан: ${saved.amount} ${saved.currency}` +
          (saved.category ? `, категория: ${saved.category}` : "") +
          ` (${gelText})`
      );
    } catch (err) {
      console.error(`[handlers] insertTransaction failed: ${(err as Error).message}`);
      await ctx.reply("Не удалось сохранить операцию. Попробуй позже.");
    }
  });

  bot.catch((err) => {
    console.error(`[bot] Unhandled error: ${err.message}`);
  });
}
