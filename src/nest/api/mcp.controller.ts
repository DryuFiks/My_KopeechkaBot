import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { getBalanceOverview } from "../../db";
import {
  latestBalances,
  listActiveTokens,
  createToken,
  recentOperations,
  revokeToken,
  MAX_ACTIVE_TOKENS,
} from "../../db/mcp";
import { reconcile } from "../../mcp/rules";
import { generateToken, hashToken } from "../../mcp/tokens";
import type { WebAppUser } from "../../telegramAuth";
import { TelegramAuthGuard, WebUser } from "./auth.guard";

const MAX_LABEL = 40;
const JOURNAL = 20;

/** MKB-063: the «Подключить ИИ» card in the Profile — links, journal of agent records, balance check. */
@Controller("api/mcp")
@UseGuards(TelegramAuthGuard)
export class McpManageController {
  @Get()
  async overview(@WebUser() user: WebAppUser) {
    const [tokens, journal, balances, calculated] = await Promise.all([
      listActiveTokens(user.id),
      recentOperations(user.id, JOURNAL, true),
      latestBalances(user.id),
      getBalanceOverview(user.id),
    ]);
    return {
      maxTokens: MAX_ACTIVE_TOKENS,
      tokens: tokens.map((t) => ({
        id: t.id,
        label: t.label,
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      })),
      journal: journal.map((r) => ({
        id: r.id,
        type: r.type,
        amount: r.amount,
        currency: r.currency,
        category: r.category,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      })),
      balances: balances.map((b) => ({
        account: b.account,
        amount: b.amount,
        currency: b.currency,
        asOf: b.asOf.toISOString(),
      })),
      reconciliation: balances.length > 0 ? reconcile(balances, calculated.totalGel) : null,
    };
  }

  /** The plain token is returned exactly once, here; only its hash is stored. */
  @Post("tokens")
  async create(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label || label.length > MAX_LABEL) throw new BadRequestException("invalid label");
    const token = generateToken();
    const id = await createToken(user.id, hashToken(token), label);
    if (id === null) throw new ConflictException("token limit reached");
    return { id, token };
  }

  @Delete("tokens/:id")
  async revoke(@WebUser() user: WebAppUser, @Param("id", ParseIntPipe) id: number) {
    return { revoked: await revokeToken(user.id, id) };
  }
}
