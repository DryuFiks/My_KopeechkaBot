import "dotenv/config";
import { Bot } from "grammy";
import { checkConnection, closePool } from "./db";
import { registerHandlers } from "./handlers";
import { loadRateCacheFromDb, refreshRatesIfStale } from "./currency";
import { logger } from "./logger";
import { processDueRecurring } from "./recurring";

async function main(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error("BOT_TOKEN is not set. Check your .env file.");
  }

  logger.info("Checking database connection...");
  await checkConnection();
  logger.info("Database OK.");

  logger.info("Loading exchange rate cache...");
  await loadRateCacheFromDb();
  await refreshRatesIfStale();

  const bot = new Bot(token);
  registerHandlers(bot);
  // Poll due recurring payments every minute. DB row locks protect against duplicates.
  const recurringTimer = setInterval(() => {
    void processDueRecurring((userId, text) => bot.api.sendMessage(userId, text))
      .catch((err) => logger.error(`Recurring scheduler failed: ${err instanceof Error ? err.message : String(err)}`));
  }, 60_000);
  void processDueRecurring((userId, text) => bot.api.sendMessage(userId, text))
    .catch((err) => logger.error(`Initial recurring run failed: ${err instanceof Error ? err.message : String(err)}`));

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, stopping bot...`);
    clearInterval(recurringTimer);
    await bot.stop();
    await closePool();
    process.exit(0);
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  logger.info("Starting bot (polling)...");
  await bot.start({
    onStart: () => logger.info("Bot is running."),
  });
}

main().catch((err) => {
  logger.error(`Fatal startup error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
