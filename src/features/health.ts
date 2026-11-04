import { Bot } from "grammy";
import { checkConnection } from "../db";
import { getAllRateInfo } from "../currency";
import { getCounters, getUptimeMs } from "../metrics";
import { renderScreen, PARSE_MODE } from "../format";
import { safe } from "../middleware/safe";
import { formatActivityLines, formatUptime } from "../adminAlertRules";
import { getActivityStats } from "../db/admin";

/** Admin-only diagnostic snapshot (MKB-016) — the closest thing to a "health check" a polling-only bot with no HTTP server can have. */
export function registerHealthHandlers(bot: Bot): void {
  bot.command(
    "health",
    safe("/health", async (ctx) => {
      const adminId = Number(process.env.ADMIN_TELEGRAM_ID);
      if (!Number.isInteger(adminId) || adminId <= 0 || ctx.from?.id !== adminId) {
        await ctx.reply("Доступно только администратору.");
        return;
      }

      let dbStatus = "OK";
      let activityLines: string[] = [];
      try {
        await checkConnection();
        activityLines = ["", ...formatActivityLines(await getActivityStats())];
      } catch (err) {
        dbStatus = `недоступна — ${(err as Error).message}`;
      }

      const rates = getAllRateInfo();
      const rateLines = rates.map((r) =>
        r.rateToGel === null
          ? `${r.currency}: недоступен`
          : `${r.currency}: ${r.isFallback ? "устаревший (кеш)" : "свежий"}`,
      );

      const counters = getCounters();

      const text = renderScreen({
        title: "Состояние бота",
        lines: [
          `Аптайм: ${formatUptime(getUptimeMs())}`,
          `БД: ${dbStatus}`,
          "Курсы валют:",
          ...rateLines.map((line) => `  ${line}`),
          ...activityLines,
          "",
          `Ошибок в хендлерах: ${counters.handlerErrors}`,
          `Откатов на кеш курса: ${counters.rateFallbacks}`,
          `Срабатываний идемпотентных guard'ов: ${counters.idempotentGuardHits}`,
        ],
      });
      await ctx.reply(text, { parse_mode: PARSE_MODE });
    }),
  );
}
