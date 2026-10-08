import { Module } from "@nestjs/common";
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
  ],
})
export class AppModule {}
