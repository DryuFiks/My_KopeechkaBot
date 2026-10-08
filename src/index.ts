import "dotenv/config";
import "reflect-metadata";
import { join } from "path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./nest/app.module";
import { logger } from "./logger";

async function main(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ["error", "warn"] });
  // SIGINT/SIGTERM → onApplicationShutdown у BotService и onModuleDestroy у DatabaseService.
  app.enableShutdownHooks();
  // Собранный webapp (webapp/dist) отдаётся с того же origin, что и /api — CORS не нужен.
  app.useStaticAssets(join(process.cwd(), "webapp", "dist"));
  const port = Number(process.env.API_PORT) || 3000;
  await app.listen(port, "127.0.0.1");
  logger.info(`HTTP listening on 127.0.0.1:${port} (webapp + /api)`);
}

main().catch((err) => {
  logger.error(`Fatal startup error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
