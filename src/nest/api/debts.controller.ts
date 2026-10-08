import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { simulatePayoff, totalMinimums } from "../../debtPayoff";
import { createDebt, deleteDebt, listDebts } from "../../db/debts";
import { TelegramAuthGuard, WebUser } from "./auth.guard";
import type { WebAppUser } from "../../telegramAuth";

function num(value: unknown, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new BadRequestException("invalid number");
  return Math.round(n * 100) / 100;
}

@Controller("api/debts")
@UseGuards(TelegramAuthGuard)
export class DebtsController {
  @Get()
  list(@WebUser() user: WebAppUser) {
    return listDebts(user.id);
  }

  /** Сравнение стратегий при фиксированном месячном бюджете (по умолчанию — сумма минимальных платежей). */
  @Get("plan")
  async plan(@WebUser() user: WebAppUser, @Query("monthly") monthly?: string) {
    const debts = await listDebts(user.id);
    const minRequiredGel = totalMinimums(debts);
    const budget = monthly === undefined || monthly === "" ? minRequiredGel : num(monthly, 1e9);
    if (budget < minRequiredGel) throw new BadRequestException("budget below minimum payments");
    if (debts.length > 0 && budget <= 0) throw new BadRequestException("budget must be positive");
    return {
      monthlyGel: budget,
      minRequiredGel,
      avalanche: simulatePayoff(debts, budget, "avalanche"),
      snowball: simulatePayoff(debts, budget, "snowball"),
    };
  }

  @Post()
  create(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 60) throw new BadRequestException("invalid name");
    return createDebt(user.id, {
      name,
      balanceGel: num(body.balanceGel, 1e9),
      ratePercent: num(body.ratePercent ?? 0, 999),
      minPaymentGel: num(body.minPaymentGel ?? 0, 1e9),
    });
  }

  @Delete(":id")
  async remove(@WebUser() user: WebAppUser, @Param("id", ParseIntPipe) id: number) {
    return { deleted: await deleteDebt(user.id, id) };
  }
}
