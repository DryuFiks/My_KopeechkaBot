import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database.module";
import { BotModule } from "./bot.module";
import { HealthController } from "./health.controller";

@Module({ imports: [DatabaseModule, BotModule], controllers: [HealthController] })
export class AppModule {}
