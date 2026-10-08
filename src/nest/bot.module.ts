import { Injectable, Module, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { Bot } from "grammy";
import { registerHandlers } from "../handlers";
import { registerNavigationHandlers } from "../handlers/navigation";
import { registerMenuActionHandlers } from "../handlers/menuActions";
import { registerTextFlowHandlers } from "../handlers/textFlow";
import { registerFeatureHandlers } from "../features";
import { loadRateCacheFromDb, refreshRatesIfStale } from "../currency";
import { startPaymentReminders } from "../reminders";
import { logger } from "../logger";

/**
 * Кнопка рядом с полем ввода, открывающая WebApp. Нужен https-адрес (WEBAPP_URL); сбой не должен
 * мешать запуску бота. Кнопка «Open» в списке чатов настраивается отдельно в @BotFather (Main Mini App).
 */
async function setWebAppMenuButton(bot: Bot): Promise<void> {
  const url = process.env.WEBAPP_URL;
  if (!url || !url.startsWith("https://")) return;
  try {
    await bot.api.setChatMenuButton({ menu_button: { type: "web_app", text: "Копеечка", web_app: { url } } });
    logger.info("WebApp menu button set.");
  } catch (err) {
    logger.warn(`Could not set the WebApp menu button: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Запускает grammY-бота (long polling) внутри жизненного цикла Nest. Хендлеры пока прежние. */
@Injectable()
export class BotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private bot?: Bot;

  async onApplicationBootstrap(): Promise<void> {
    const token = process.env.BOT_TOKEN;
    if (!token) {
      throw new Error("BOT_TOKEN is not set. Check your .env file.");
    }

    logger.info("Loading exchange rate cache...");
    await loadRateCacheFromDb();
    await refreshRatesIfStale();

    const bot = new Bot(token);
    registerHandlers(bot);
    registerNavigationHandlers(bot);
    registerMenuActionHandlers(bot);
    registerFeatureHandlers(bot);
    registerTextFlowHandlers(bot);
    startPaymentReminders(bot);
    this.bot = bot;

    await setWebAppMenuButton(bot);

    logger.info("Starting bot (polling)...");
    // Не await: start() живёт, пока работает бот, а HTTP-серверу нужно успеть подняться.
    bot.start({ onStart: () => logger.info("Bot is running.") }).catch((err) => {
      logger.error(`Bot stopped with error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    logger.info(`Stopping bot${signal ? ` (${signal})` : ""}...`);
    await this.bot?.stop();
  }
}

@Module({ providers: [BotService] })
export class BotModule {}
