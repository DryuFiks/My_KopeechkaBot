import { Bot } from "grammy";
import { registerAnalyticsHandlers } from "./features/analytics";
import { registerPlanningHandlers } from "./features/planning";
import { registerStatsHandlers } from "./features/stats";
import { registerDashboardHandlers } from "./features/dashboard";
import { registerTrendHandlers } from "./features/trend";
import { registerSettingsHandlers } from "./features/settings";
import { registerPaymentsHandlers } from "./features/payments";
import { registerGoalsHandlers } from "./features/goals";
import { registerHealthHandlers } from "./features/health";
import { registerProgressHandlers } from "./features/progress";

export function registerFeatureHandlers(bot: Bot): void {
  registerAnalyticsHandlers(bot);
  registerPlanningHandlers(bot);
  registerStatsHandlers(bot);
  registerDashboardHandlers(bot);
  registerTrendHandlers(bot);
  registerSettingsHandlers(bot);
  registerPaymentsHandlers(bot);
  registerGoalsHandlers(bot);
  registerHealthHandlers(bot);
  registerProgressHandlers(bot);
}
