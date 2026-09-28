import { Bot, Context } from "grammy";
import { getAllRateInfo, refreshRatesIfStale } from "./currency";
import {
  getLastTransactions,
  getSummaryForRange,
  deleteTransactionById,
  Transaction,
  PeriodSummary,
} from "./db";
import {
  escapeHtml,
  formatDateShort,
  formatMoney,
  formatPeriodLabel,
  formatSignedAmount,
  renderScreen,
  PARSE_MODE,
} from "./format";
import { logger } from "./logger";
import { confirmActionKeyboard, emptyKeyboard, mainKeyboard } from "./keyboards";
import { safe, safeCallback } from "./middleware/safe";

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
/rate — используемые курсы валют и когда они обновлялись`;

const START_MESSAGE = `Привет! Я — бот для учёта доходов и расходов.\n\n${HELP_MESSAGE}`;

function formatTx(tx: Transaction): string {
  const amountText = formatSignedAmount(tx.type, tx.amount, tx.currency);
  const gel = tx.amount_gel !== null ? `≈ ${formatMoney(tx.amount_gel, "GEL")}` : "курс недоступен";
  const cat = tx.category ? ` [${escapeHtml(tx.category)}]` : "";
  const note = tx.note ? ` — ${escapeHtml(tx.note)}` : "";
  const date = formatDateShort(tx.created_at);
  return `${escapeHtml(date)}  ${amountText}${cat}${note}  (${gel})`;
}

function formatSummary(title: string, from: Date, to: Date, summary: PeriodSummary): string {
  const lines = [
    formatPeriodLabel(from, to),
    "",
    `Доходы: ${formatSignedAmount("income", summary.income_gel, "GEL")}`,
    `Расходы: ${formatSignedAmount("expense", summary.expense_gel, "GEL")}`,
    `Баланс: ${formatMoney(summary.balance_gel, "GEL")}`,
    `Операций: ${summary.operation_count}`,
  ];
  if (summary.unconverted_count > 0) {
    lines.push(`⚠️ ${summary.unconverted_count} операц. без курса — не учтены в сумме`);
  }
  return renderScreen({ title, lines });
}

export function registerHandlers(bot: Bot): void {
  const showMainMenu = async (ctx: Context): Promise<void> => {
    // Remove a persistent ReplyKeyboard left over from an older bot version.
    await ctx.reply("Открываю меню…", { reply_markup: { remove_keyboard: true } });
    await ctx.reply(START_MESSAGE, {
      parse_mode: PARSE_MODE,
      reply_markup: mainKeyboard,
    });
  };

  bot.command(
    "start",
    safe("/start", async (ctx) => {
      await showMainMenu(ctx);
    }),
  );

  bot.command(
    "menu",
    safe("/menu", async (ctx) => {
      await showMainMenu(ctx);
    }),
  );

  bot.command(
    "help",
    safe("/help", async (ctx) => {
      await ctx.reply(HELP_MESSAGE, { parse_mode: PARSE_MODE });
    }),
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
        const updated = r.updatedAt ? ` (обновлено ${formatDateShort(r.updatedAt)})` : "";
        return `${r.currency} → ${r.rateToGel} GEL${updated}${staleTag}`;
      });
      await ctx.reply(`Текущие курсы (источник: NBG — Национальный банк Грузии):\n${lines.join("\n")}`);
    }),
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
      await ctx.reply(formatSummary("Итоги за сегодня", from, to, summary), { parse_mode: PARSE_MODE });
    }),
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
      await ctx.reply(formatSummary("Итоги за месяц", from, to, summary), { parse_mode: PARSE_MODE });
    }),
  );

  bot.command(
    "last",
    safe("/last", async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      const txs = await getLastTransactions(userId, 10);
      const text = renderScreen({
        title: "Последние операции",
        lines: txs.map(formatTx),
        emptyText: "Операций пока нет. Отправь первую, например: -20 gel транспорт",
      });
      await ctx.reply(text, { parse_mode: PARSE_MODE });
    }),
  );

  bot.command(
    "undo",
    safe("/undo", async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      const [last] = await getLastTransactions(userId, 1);
      if (!last) {
        await ctx.reply("Нечего отменять — операций нет.");
        return;
      }
      await ctx.reply(`Отменить последнюю операцию?\n${formatTx(last)}`, {
        parse_mode: PARSE_MODE,
        reply_markup: confirmActionKeyboard(`undocmd:${last.id}:yes`, `undocmd:${last.id}:no`),
      });
    }),
  );

  bot.callbackQuery(
    /^undocmd:(\d+):(yes|no)$/,
    safeCallback("undo confirm", async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.answerCallbackQuery();
        return;
      }
      if (ctx.match[2] === "no") {
        await ctx.answerCallbackQuery({ text: "Отменено" });
        await ctx.editMessageText("Действие отменено.", { reply_markup: emptyKeyboard }).catch(() => {});
        return;
      }
      const deleted = await deleteTransactionById(userId, Number(ctx.match[1]));
      if (!deleted) {
        await ctx.answerCallbackQuery({ text: "Уже отменено", show_alert: true });
        await ctx
          .editMessageText("Нечего отменять — уже отменено.", { reply_markup: emptyKeyboard })
          .catch(() => {});
        return;
      }
      await ctx.answerCallbackQuery({ text: "Отменено" });
      await ctx
        .editMessageText(`Отменено: ${formatTx(deleted)}`, {
          parse_mode: PARSE_MODE,
          reply_markup: emptyKeyboard,
        })
        .catch(() => {});
    }),
  );

  bot.catch((err) => {
    logger.error(`Unhandled bot error: ${err.message}`);
  });
}
