import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  createPayment,
  deletePayment,
  listPayments,
  togglePaymentActive,
  type RecurringPayment,
} from "../../db/payments";
import { getUserSettings } from "../../db/settings";
import { nextDueDate } from "../../paymentDueCheck";
import { zonedToday } from "../../timezone";
import type { WebAppUser } from "../../telegramAuth";
import { TelegramAuthGuard, WebUser } from "./auth.guard";
import { currency, money, name } from "./validation";

function present(p: RecurringPayment, today: { year: number; month: number; day: number }) {
  return {
    id: p.id,
    title: p.title,
    amount: Number(p.amount),
    currency: p.currency,
    category: p.category,
    dueDay: p.due_day,
    active: p.active,
    next: nextDueDate(p.due_day, today),
  };
}

/**
 * MKB-059: recurring payments in the WebApp — the same rows as /payment in the chat. Reminders stay
 * reminders: nothing here records an expense (MKB-012). Every id is resolved with the caller's user_id.
 */
@Controller("api/payments")
@UseGuards(TelegramAuthGuard)
export class PaymentsController {
  private async today(userId: number) {
    return zonedToday((await getUserSettings(userId)).timezone);
  }

  @Get()
  async list(@WebUser() user: WebAppUser) {
    const today = await this.today(user.id);
    return { items: (await listPayments(user.id)).map((p) => present(p, today)) };
  }

  @Post()
  async create(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    const dueDay = Number(body.dueDay);
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) throw new BadRequestException("invalid day");
    const p = await createPayment(
      user.id,
      dueDay,
      money(body.amount, { allowZero: false }),
      currency(body.currency),
      name(body.title, 120),
    );
    return present(p, await this.today(user.id));
  }

  /** Pause ↔ resume. */
  @Post(":id/toggle")
  async toggle(@WebUser() user: WebAppUser, @Param("id", ParseIntPipe) id: number) {
    const p = await togglePaymentActive(user.id, id);
    if (!p) throw new NotFoundException();
    return present(p, await this.today(user.id));
  }

  /** Deleting twice just reports `deleted: false`. */
  @Delete(":id")
  async remove(@WebUser() user: WebAppUser, @Param("id", ParseIntPipe) id: number) {
    return { deleted: (await deletePayment(user.id, id)) !== null };
  }
}
