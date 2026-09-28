import { Bot } from "grammy";
import { registerAnalyticsHandlers } from "./features/analytics";
import { registerPlanningHandlers } from "./features/planning";

export function registerFeatureHandlers(bot: Bot): void {
  registerAnalyticsHandlers(bot);
  registerPlanningHandlers(bot);
}
