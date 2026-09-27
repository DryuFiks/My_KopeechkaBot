import "dotenv/config";
import { Bot } from "grammy";
import { checkConnection, closePool } from "./db";
import { registerHandlers } from "./handlers";

async function main(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error("BOT_TOKEN is not set. Check your .env file.");
  }

  console.log("[startup] Checking database connection...");
  await checkConnection();
  console.log("[startup] Database OK.");

  const bot = new Bot(token);
  registerHandlers(bot);

  const shutdown = async (signal: string) => {
    console.log(`[shutdown] Received ${signal}, stopping bot...`);
    await bot.stop();
    await closePool();
    process.exit(0);
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  console.log("[startup] Starting bot (polling)...");
  await bot.start();
}

main().catch((err) => {
  console.error(`[fatal] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
