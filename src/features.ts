import { Bot } from "grammy";
import { registerAnalyticsHandlers } from "./features/analytics";
import { registerPlanningHandlers } from "./features/planning";
import { registerStatsHandlers } from "./features/stats";
import { registerDashboardHandlers } from "./features/dashboard";
import { registerTrendHandlers } from "./features/trend";

export function registerFeatureHandlers(bot: Bot): void {
  registerAnalyticsHandlers(bot);
  registerPlanningHandlers(bot);
  registerStatsHandlers(bot);
  registerDashboardHandlers(bot);
  registerTrendHandlers(bot);
}
