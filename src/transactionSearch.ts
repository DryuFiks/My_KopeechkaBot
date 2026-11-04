// Pure part of searching operations (MKB-056): query text → ILIKE pattern, type filter. No DB.

import type { TransactionType } from "./parser";

const MAX_QUERY = 60;

export interface TransactionFilter {
  /** ILIKE pattern for category or comment, with %, _ and \ escaped; null — no text search. */
  pattern: string | null;
  type: TransactionType | null;
}

export function parseTransactionFilter(q: string | undefined, type: string | undefined): TransactionFilter {
  const text = (q ?? "").trim().slice(0, MAX_QUERY);
  return {
    pattern: text ? `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null,
    type: type === "expense" || type === "income" ? type : null,
  };
}
