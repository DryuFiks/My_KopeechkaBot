import { api } from "@/shared/api/client";
import type { Currency } from "@/shared/lib/money";

export interface McpToken {
  id: number;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface McpOperation {
  id: number;
  type: "expense" | "income";
  amount: number;
  currency: Currency;
  category: string | null;
  note: string | null;
  createdAt: string;
}

export interface McpBalance {
  account: string;
  amount: number;
  currency: Currency;
  asOf: string;
}

export interface McpReconciliation {
  bankTotalGel: number;
  calculatedGel: number;
  /** Банк минус бот: плюс — в банке больше, чем записано в боте. */
  differenceGel: number;
  matches: boolean;
  notConverted: string[];
}

export interface McpOverview {
  maxTokens: number;
  tokens: McpToken[];
  journal: McpOperation[];
  balances: McpBalance[];
  reconciliation: McpReconciliation | null;
}

export const fetchMcp = () => api.get<McpOverview>("/mcp");
/** Токен в ответе виден единственный раз: на сервере остаётся только его хэш. */
export const createMcpToken = (label: string) => api.post<{ id: number; token: string }>("/mcp/tokens", { label });
export const revokeMcpToken = (id: number) => api.delete<{ revoked: boolean }>(`/mcp/tokens/${id}`);
