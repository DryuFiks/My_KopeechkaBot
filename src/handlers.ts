import { Bot, Context } from "grammy";
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
import { mainKeyboard } from "./keyboards";

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

  bot.hears(
    "📖 Все команды",
    safe("all commands", async (ctx) => {
      await ctx.reply(
        HELP_MESSAGE +
          `

<b>Дополнительные команды</b>
/menu — открыть меню
/budget Категория сумма — задать лимит
/category expense Еда — добавить категорию расхода
/category income Зарплата — добавить категорию дохода
/goal Название сумма — создать цель
/save ID сумма — пополнить цель
/payment день сумма валюта название — добавить платёж
/payments — список платежей
/deletepayment ID — отключить платёж
/deletegoal ID — закрыть цель

Кнопки меню: 💰 Финансы, 📊 Аналитика, 🗓 Планирование, 🛠 Сервис.`,
        { parse_mode: PARSE_MODE, reply_markup: mainKeyboard },
      );
    }),
  );

  bot.hears(
    "💱 Курсы валют",
    safe("rate button", async (ctx) => {
      await refreshRatesIfStale();
      const rates = getAllRateInfo();
      const lines = rates.map((r) =>
        r.rateToGel === null
          ? `${r.currency} → курс недоступен`
          : `${r.currency} → ${r.rateToGel.toFixed(4)} GEL${r.isFallback ? " ⚠️ кеш" : ""}`,
      );
      await ctx.reply(
        `Курсы валют (Национальный банк Грузии):\n${lines.join("\n")}\n\nИсточник: NBG — Национальный банк Грузии`,
        {
          reply_markup: mainKeyboard,
        },
      );
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
        const updated = r.updatedAt
          ? ` (обновлено ${r.updatedAt.toISOString().slice(0, 16).replace("T", " ")})`
          : "";
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
      await ctx.reply(formatSummary("Итоги за сегодня", summary), { parse_mode: PARSE_MODE });
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
      await ctx.reply(formatSummary("Итоги за месяц", summary), { parse_mode: PARSE_MODE });
    }),
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
    }),
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
    }),
  );

  // Plain text messages — attempt to parse as a transaction.
  bot.on("message:text", async (ctx, next) => {
    const menuLabels = new Set([
      "➖ Расход",
      "➕ Доход",
      "📊 Бюджет",
      "🧾 История",
      "🔁 Платежи",
      "🎯 Накопления",
      "📈 Статистика",
      "⚙️ Настройки",
      "🔄 Перезапуск",
      "❌ Отмена",
      "💰 Финансы",
      "📊 Аналитика",
      "🗓 Планирование",
      "🛠 Сервис",
      "⬅️ Главное меню",
    ]);
    if (menuLabels.has(ctx.message.text.trim())) return next();
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
