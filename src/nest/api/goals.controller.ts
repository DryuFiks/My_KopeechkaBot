import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { getSummaryForRange } from "../../db";
import { contributeToGoal, createGoal, listGoals, type SavingsGoal } from "../../db/goals";
import { averageMonthlySavings, monthsToGoal, requiredMonthly } from "../../savingsForecast";
import { TelegramAuthGuard, WebUser } from "./auth.guard";
import type { WebAppUser } from "../../telegramAuth";

const DAY_MS = 86_400_000;
const WINDOW_MONTHS = 3;

function positive(value: unknown, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > max) throw new BadRequestException("invalid amount");
  return Math.round(n * 100) / 100;
}

function toDateOnly(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new BadRequestException("invalid date");
  }
  return value;
}

/** pg returns a DATE column as local midnight, so read local parts — toISOString() would shift the day. */
function localDateString(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function present(g: SavingsGoal, monthlySavingsGel: number, now: Date) {
  const target = Number(g.target_gel);
  const saved = Number(g.saved_gel);
  const remaining = Math.max(0, Math.round((target - saved) * 100) / 100);
  return {
    id: Number(g.id),
    title: g.title,
    targetGel: target,
    savedGel: saved,
    remainingGel: remaining,
    targetDate: g.target_date ? localDateString(new Date(g.target_date)) : null,
    monthsAtCurrentPace: monthsToGoal(remaining, monthlySavingsGel),
    required: requiredMonthly(remaining, g.target_date ? new Date(g.target_date) : null, now),
  };
}

@Controller("api/goals")
@UseGuards(TelegramAuthGuard)
export class GoalsController {
  /** Forecast assumes ALL recent surplus goes to a goal — it is per-goal, not split between goals. */
  @Get()
  async list(@WebUser() user: WebAppUser) {
    const now = new Date();
    const [goals, s] = await Promise.all([
      listGoals(user.id),
      getSummaryForRange(user.id, new Date(now.getTime() - 90 * DAY_MS), now),
    ]);
    const monthlySavingsGel = averageMonthlySavings(s.income_gel, s.expense_gel, WINDOW_MONTHS);
    return { monthlySavingsGel, goals: goals.map((g) => present(g, monthlySavingsGel, now)) };
  }

  @Post()
  async create(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    if (!title) throw new BadRequestException("invalid title");
    const g = await createGoal(user.id, title, positive(body.targetGel, 1e9), toDateOnly(body.targetDate));
    return present(g, 0, new Date());
  }

  @Post(":id/contribute")
  async contribute(
    @WebUser() user: WebAppUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    const g = await contributeToGoal(user.id, id, positive(body.amountGel, 1e9));
    if (!g) throw new NotFoundException();
    return present(g, 0, new Date());
  }
}
