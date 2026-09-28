import { Bot } from "grammy";
import { registerAnalyticsHandlers } from "./features/analytics";
import { registerPlanningHandlers } from "./features/planning";
import { registerStatsHandlers } from "./features/stats";
import { registerDashboardHandlers } from "./features/dashboard";
import { registerTrendHandlers } from "./features/trend";
import { registerSettingsHandlers } from "./features/settings";

export function registerFeatureHandlers(bot: Bot): void {
  registerAnalyticsHandlers(bot);
  registerPlanningHandlers(bot);
  registerStatsHandlers(bot);
  registerDashboardHandlers(bot);
  registerTrendHandlers(bot);
  registerSettingsHandlers(bot);
}
