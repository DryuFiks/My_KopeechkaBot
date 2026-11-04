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
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { getCategoryOptions } from "../../categoryOptions";
import { convertToGel, refreshRatesIfStale } from "../../currency";
import { deleteTransactionById, getLastTransactions, insertTransaction } from "../../db";
import { getUserSettings } from "../../db/settings";
import { trackEvent } from "../../db/events";
import { findTransaction, updateTransaction } from "../../db/transactions";
import { editedOperationTime, parseIsoDate, recomputeAmountGel } from "../../transactionEdit";
import { zonedDateBoundary, zonedDayBoundaries } from "../../timezone";
import type { TransactionType } from "../../parser";
import type { WebAppUser } from "../../telegramAuth";
import { TelegramAuthGuard, WebUser } from "./auth.guard";
import { currency, money } from "./validation";
import { presentTransaction } from "./transactionView";

const MAX_NOTE = 200;
const MAX_CATEGORY = 60;
const RECENT = 5;

function txType(value: unknown): TransactionType {
  if (value !== "expense" && value !== "income") throw new BadRequestException("invalid type");
  return value;
}

function optionalText(value: unknown, max: number, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new BadRequestException(`invalid ${label}`);
  const text = value.trim();
  if (text.length > max) throw new BadRequestException(`invalid ${label}`);
  return text === "" ? null : text;
}

@Controller("api/transactions")
@UseGuards(TelegramAuthGuard)
export class TransactionsController {
  /** Categories for the picker, in the same order the chat wizard shows them. */
  @Get("categories")
  async categories(@WebUser() user: WebAppUser, @Query("type") type?: string) {
    return { categories: await getCategoryOptions(user.id, txType(type ?? "expense")) };
  }

  /** MKB-051: the last few operations for the home screen, newest first. */
  @Get("recent")
  async recent(@WebUser() user: WebAppUser) {
    return { items: (await getLastTransactions(user.id, RECENT)).map(presentTransaction) };
  }

  /**
   * Records one operation. The user id comes only from the signed initData; the GEL amount is
   * computed here at the user's own exchanger rate (never trusted from the client). A rate that
   * is unavailable stores the operation without a GEL amount, exactly like the chat does.
   */
  @Post()
  async create(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    const type = txType(body.type);
    const cur = currency(body.currency);
    const amount = money(body.amount, { allowZero: false });
    const category = optionalText(body.category, MAX_CATEGORY, "category");
    const note = optionalText(body.note, MAX_NOTE, "note");

    await refreshRatesIfStale();
    const { exchangeFactor } = await getUserSettings(user.id);
    const amountGel = convertToGel(amount, cur, exchangeFactor);
    const saved = await insertTransaction({
      userId: user.id,
      type,
      amount,
      currency: cur,
      amountGel,
      category,
      note,
    });
    trackEvent(user.id, "tx_created", "webapp");
    return { id: saved.id, amountGel };
  }

  /**
   * MKB-053: edit amount, currency, category, comment and day of one of the caller's operations.
   * Someone else's id is 404. The GEL value is recomputed on the server (transactionEdit.ts):
   * same currency keeps the original rate, another currency takes today's.
   */
  @Put(":id")
  async update(
    @WebUser() user: WebAppUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    const existing = await findTransaction(user.id, id);
    if (!existing) throw new NotFoundException();
    const cur = currency(body.currency);
    const amount = money(body.amount, { allowZero: false });
    const category = optionalText(body.category, MAX_CATEGORY, "category");
    const note = optionalText(body.note, MAX_NOTE, "note");
    const { timezone, exchangeFactor } = await getUserSettings(user.id);

    let createdAt = existing.created_at;
    if (body.date !== undefined) {
      const d = parseIsoDate(body.date);
      if (!d) throw new BadRequestException("invalid date");
      const dayStart = zonedDateBoundary(d.year, d.month, d.day, timezone);
      // The same day keeps the original time; another day moves the operation to its noon.
      if (dayStart.getTime() !== zonedDayBoundaries(existing.created_at, timezone).from.getTime()) {
        const moved = editedOperationTime(dayStart, zonedDayBoundaries(new Date(), timezone).from);
        if (!moved) throw new BadRequestException("invalid date");
        createdAt = moved;
      }
    }

    await refreshRatesIfStale();
    const amountGel = recomputeAmountGel({
      oldAmount: Number(existing.amount),
      oldCurrency: existing.currency,
      oldAmountGel: existing.amount_gel === null ? null : Number(existing.amount_gel),
      newAmount: amount,
      newCurrency: cur,
      todayGel: convertToGel(amount, cur, exchangeFactor),
    });
    const saved = await updateTransaction(user.id, id, {
      amount,
      currency: cur,
      amountGel,
      category,
      note,
      createdAt,
    });
    if (!saved) throw new NotFoundException();
    trackEvent(user.id, "tx_edited", "webapp");
    return presentTransaction(saved);
  }

  /** Undo: deleting an id twice (double tap) just reports `deleted: false`, never another row. */
  @Delete(":id")
  async remove(@WebUser() user: WebAppUser, @Param("id", ParseIntPipe) id: number) {
    return { deleted: (await deleteTransactionById(user.id, id)) !== null };
  }
}
