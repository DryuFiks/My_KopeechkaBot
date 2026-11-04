import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { LogUnexpectedErrorsFilter } from "./errors.filter";
import { DatabaseModule } from "./database.module";
import { BotModule } from "./bot.module";
import { HealthController } from "./health.controller";
import { FinanceController } from "./api/finance.controller";
import { DebtsController } from "./api/debts.controller";
import { GoalsController } from "./api/goals.controller";
import { PlanController } from "./api/plan.controller";
import { SettingsController } from "./api/settings.controller";
import { ProgressController } from "./api/progress.controller";
import { CategoriesController } from "./api/categories.controller";
import { TransactionsController } from "./api/transactions.controller";
import { HistoryController } from "./api/history.controller";

@Module({
  imports: [DatabaseModule, BotModule],
  controllers: [
    HealthController,
    FinanceController,
    DebtsController,
    GoalsController,
    PlanController,
    SettingsController,
    ProgressController,
    CategoriesController,
    TransactionsController,
    HistoryController,
  ],
  providers: [{ provide: APP_FILTER, useClass: LogUnexpectedErrorsFilter }],
})
export class AppModule {}
