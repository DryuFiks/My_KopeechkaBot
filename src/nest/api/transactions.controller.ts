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
import { getCategoryOptions } from "../../categoryOptions";
import { convertToGel, refreshRatesIfStale } from "../../currency";
import { deleteTransactionById, insertTransaction } from "../../db";
import { getUserSettings } from "../../db/settings";
import type { TransactionType } from "../../parser";
import type { WebAppUser } from "../../telegramAuth";
import { TelegramAuthGuard, WebUser } from "./auth.guard";
import { currency, money } from "./validation";

const MAX_NOTE = 200;
const MAX_CATEGORY = 60;

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
    return { id: saved.id, amountGel };
  }

  /** Undo: deleting an id twice (double tap) just reports `deleted: false`, never another row. */
  @Delete(":id")
  async remove(@WebUser() user: WebAppUser, @Param("id", ParseIntPipe) id: number) {
    return { deleted: (await deleteTransactionById(user.id, id)) !== null };
  }
}
