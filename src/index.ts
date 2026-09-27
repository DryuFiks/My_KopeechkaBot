import "dotenv/config";
import { Bot } from "grammy";
import { checkConnection, closePool } from "./db";
import { registerHandlers } from "./handlers";
import { registerFeatureHandlers } from "./features";
import { loadRateCacheFromDb, refreshRatesIfStale } from "./currency";
import { logger } from "./logger";

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
  registerFeatureHandlers(bot);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, stopping bot...`);
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
