// Database-backed McpDeps (MKB-063). Imports db.ts, so it is not unit-tested; server.ts is.

import { convertToGel, refreshRatesIfStale } from "../currency";
import { getBalanceOverview } from "../db";
import { listExpenseCategories } from "../db/categories";
import {
  deleteMcpTransaction,
  insertMcpTransaction,
  latestBalances,
  listIncomeCategories,
  recentOperations,
  saveBalance,
} from "../db/mcp";
import { getUserSettings } from "../db/settings";
import type { McpDeps } from "./server";

export const dbDeps: McpDeps = {
  now: () => new Date(),
  getSettings: async (userId) => {
    const { timezone, exchangeFactor } = await getUserSettings(userId);
    return { timezone, exchangeFactor };
  },
  listCategories: (userId, type) =>
    type === "expense" ? listExpenseCategories(userId) : listIncomeCategories(userId),
  toGel: async (amount, currency, exchangeFactor) => {
    await refreshRatesIfStale();
    return convertToGel(amount, currency, exchangeFactor);
  },
  insertTransaction: insertMcpTransaction,
  recent: (userId, limit) => recentOperations(userId, limit),
  deleteMcpTransaction,
  saveBalance,
  latestBalances,
  calculatedBalanceGel: async (userId) => (await getBalanceOverview(userId)).totalGel,
};
