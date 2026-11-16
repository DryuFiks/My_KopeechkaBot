// MCP tools for AI agents (MKB-063). All I/O goes through `McpDeps`, so the whole protocol surface
// is tested with a fake in src/mcp/server.test.ts — no database, no network.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SupportedCurrency } from "../currencies";
import type { TransactionType } from "../parser";
import {
  MAX_ACCOUNT,
  MAX_BATCH,
  RateLimiter,
  reconcile,
  validAsOf,
  validBalance,
  validateItem,
  type BalanceSnapshot,
  type RawItem,
  type ValidItem,
} from "./rules";

export interface McpRecent {
  id: number;
  type: TransactionType;
  amount: number;
  currency: SupportedCurrency;
  category: string | null;
  note: string | null;
  createdAt: Date;
  source: string | null;
  externalId: string | null;
}

export interface McpDeps {
  now(): Date;
  getSettings(userId: number): Promise<{ timezone: string; exchangeFactor: number }>;
  listCategories(userId: number, type: TransactionType): Promise<string[]>;
  /** GEL value at the user's own rate; null when no rate is available (never invented). */
  toGel(amount: number, currency: SupportedCurrency, exchangeFactor: number): Promise<number | null>;
  /** `duplicate: true` when the same external_id was already stored for this user. */
  insertTransaction(
    userId: number,
    item: ValidItem,
    amountGel: number | null,
  ): Promise<{ id: number; duplicate: boolean }>;
  recent(userId: number, limit: number): Promise<McpRecent[]>;
  /** Deletes only rows written through MCP; false for anything else or an unknown id. */
  deleteMcpTransaction(userId: number, id: number): Promise<boolean>;
  saveBalance(userId: number, snap: BalanceSnapshot & { asOf: Date }): Promise<void>;
  latestBalances(userId: number): Promise<BalanceSnapshot[]>;
  calculatedBalanceGel(userId: number): Promise<number>;
}

export interface McpContext {
  userId: number;
  /** Key for the write limiter — the token id, so one leaked link cannot starve the others. */
  limitKey: string;
  limiter: RateLimiter;
}

const INSTRUCTIONS = [
  "Personal-finance bot. You record the user's money operations and report bank balances.",
  "Workflow for a bank statement: 1) call list_categories; 2) call add_transactions with every line,",
  "passing the bank's own transaction id as external_id (or a stable one such as date|amount|merchant|n) —",
  "re-sending the same external_id is safe and reports status=duplicate; 3) call report_balance with the",
  "closing balance of each account to check that the bot's totals match the bank.",
  "Amounts are always positive; the direction is `type` (expense or income). Never guess a category:",
  "leave it out when none fits. Currencies: RUB, GEL, USD. Use get_recent / delete_transaction to undo mistakes.",
].join(" ");

function reply(data: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    ...(isError ? { isError } : {}),
  };
}

const itemSchema = z.object({
  type: z.enum(["expense", "income"]).describe("expense = money spent, income = money received"),
  amount: z.number().positive().describe("Positive amount in the operation's own currency"),
  currency: z.string().describe("RUB, GEL or USD"),
  category: z.string().optional().describe("One of the names from list_categories; omit if none fits"),
  note: z.string().optional().describe("Short comment, e.g. the merchant (max 200 chars)"),
  date: z.string().optional().describe("Day of the operation, YYYY-MM-DD; omit for 'now'"),
  external_id: z.string().optional().describe("Bank's transaction id; makes re-sending safe (max 100 chars)"),
});

export function createMcpServer(deps: McpDeps, ctx: McpContext): McpServer {
  const server = new McpServer({ name: "kopeechka-bot", version: "1.0.0" }, { instructions: INSTRUCTIONS });
  const { userId } = ctx;

  server.registerTool(
    "list_categories",
    {
      description: "The user's categories for expenses or income. Use these exact names in add_transactions.",
      inputSchema: { type: z.enum(["expense", "income"]).optional().describe("Default: expense") },
      annotations: { readOnlyHint: true },
    },
    async ({ type }) => reply({ categories: await deps.listCategories(userId, type ?? "expense") }),
  );

  server.registerTool(
    "add_transactions",
    {
      description:
        `Records up to ${MAX_BATCH} operations at once. Returns a status per item in the same order: ` +
        "created, duplicate (same external_id already stored) or error (fix and re-send only that item).",
      inputSchema: { items: z.array(itemSchema).min(1).max(MAX_BATCH) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ items }) => {
      if (!ctx.limiter.take(ctx.limitKey, items.length)) {
        return reply({ error: "rate limit: too many records per minute, wait a minute and retry" }, true);
      }
      const { timezone, exchangeFactor } = await deps.getSettings(userId);
      const now = deps.now();
      const [expense, income] = await Promise.all([
        deps.listCategories(userId, "expense"),
        deps.listCategories(userId, "income"),
      ]);
      const results: Record<string, unknown>[] = [];
      for (const [index, raw] of items.entries()) {
        const known = raw.type === "income" ? income : expense;
        const checked = validateItem(raw as RawItem, { knownCategories: known, timezone, now });
        if (!checked.ok) {
          results.push({ index, status: "error", error: checked.error });
          continue;
        }
        try {
          const amountGel = await deps.toGel(checked.item.amount, checked.item.currency, exchangeFactor);
          const saved = await deps.insertTransaction(userId, checked.item, amountGel);
          results.push({
            index,
            status: saved.duplicate ? "duplicate" : "created",
            id: saved.id,
            amount_gel: amountGel,
          });
        } catch {
          results.push({ index, status: "error", error: "could not save, try again" });
        }
      }
      const count = (status: string) => results.filter((r) => r.status === status).length;
      return reply({
        summary: { created: count("created"), duplicate: count("duplicate"), error: count("error") },
        results,
      });
    },
  );

  server.registerTool(
    "report_balance",
    {
      description:
        "Saves the current balance of one bank account and compares the bank's total with the bot's own " +
        "income-minus-expense balance. Nothing is corrected automatically. Call once per account.",
      inputSchema: {
        account: z.string().describe("Account or card name, e.g. 'TBC card'"),
        amount: z.number().describe("Balance on the account (may be negative)"),
        currency: z.string().describe("RUB, GEL or USD"),
        as_of: z.string().optional().describe("ISO date or time of the balance; omit for 'now'"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      const account = args.account.trim();
      const amount = validBalance(args.amount);
      const currency = args.currency.toUpperCase();
      const asOf = args.as_of === undefined ? deps.now() : validAsOf(args.as_of, deps.now());
      if (!account || account.length > MAX_ACCOUNT) return reply({ error: "invalid account name" }, true);
      if (amount === null) return reply({ error: "invalid amount" }, true);
      if (!["RUB", "GEL", "USD"].includes(currency))
        return reply({ error: "currency must be RUB, GEL or USD" }, true);
      if (!asOf) return reply({ error: "as_of must be an ISO date not in the future" }, true);

      const { exchangeFactor } = await deps.getSettings(userId);
      const cur = currency as SupportedCurrency;
      const amountGel = await deps.toGel(amount, cur, exchangeFactor);
      await deps.saveBalance(userId, { account, amount, currency: cur, amountGel, asOf });
      const result = reconcile(await deps.latestBalances(userId), await deps.calculatedBalanceGel(userId));
      return reply({
        saved: { account, amount, currency: cur, amount_gel: amountGel },
        reconciliation: {
          bank_total_gel: result.bankTotalGel,
          bot_balance_gel: result.calculatedGel,
          difference_gel: result.differenceGel,
          matches: result.matches,
          accounts_without_rate: result.notConverted,
        },
        note: result.matches
          ? "The bot's balance matches the bank."
          : "Difference = bank minus bot. Right after first use it equals the opening balance; otherwise some operations are missing or extra.",
      });
    },
  );

  server.registerTool(
    "get_recent",
    {
      description:
        "The user's latest operations (newest first) with ids and the source (mcp = added by an agent).",
      inputSchema: { limit: z.number().int().min(1).max(20).optional().describe("Default 10") },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      const rows = await deps.recent(userId, limit ?? 10);
      return reply({
        items: rows.map((r) => ({
          id: r.id,
          type: r.type,
          amount: r.amount,
          currency: r.currency,
          category: r.category,
          note: r.note,
          date: r.createdAt.toISOString(),
          source: r.source,
          external_id: r.externalId,
        })),
      });
    },
  );

  server.registerTool(
    "delete_transaction",
    {
      description:
        "Undoes an operation that was added through MCP. Operations the user entered by hand cannot be removed.",
      inputSchema: { id: z.number().int().positive() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ id }) => {
      const deleted = await deps.deleteMcpTransaction(userId, id);
      return deleted
        ? reply({ deleted: true })
        : reply({ deleted: false, reason: "not found, already deleted, or not added through MCP" }, true);
    },
  );

  return server;
}
