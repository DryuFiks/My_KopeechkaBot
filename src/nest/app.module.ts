import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module";
import { BotModule } from "./bot.module";
import { HealthController } from "./health.controller";
import { FinanceController } from "./api/finance.controller";
import { DebtsController } from "./api/debts.controller";

@Module({
  imports: [DatabaseModule, BotModule],
  controllers: [HealthController, FinanceController, DebtsController],
})
export class AppModule {}
