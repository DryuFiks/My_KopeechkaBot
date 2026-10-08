import { Global, Inject, Injectable, Module, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { checkConnection, closePool } from "../db";
import { logger } from "../logger";

/** Тонкая обёртка над существующим pg-пулом из db.ts: Nest управляет только его жизненным циклом. */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    logger.info("Checking database connection...");
    await checkConnection();
    logger.info("Database OK.");
  }

  async onModuleDestroy(): Promise<void> {
    await closePool();
  }

  ping(): Promise<void> {
    return checkConnection();
  }
}

export const InjectDb = () => Inject(DatabaseService);

@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
