import { pool } from "../db";
import type { SupportedCurrency } from "../currencies";
import type { TransactionType } from "../parser";
import type { BalanceSnapshot, ValidItem } from "../mcp/rules";
import type { McpRecent } from "../mcp/server";

export const MAX_ACTIVE_TOKENS = 5;

export interface McpTokenRow {
  id: number;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export async function listActiveTokens(userId: number): Promise<McpTokenRow[]> {
  const res = await pool.query<{ id: number; label: string; created_at: Date; last_used_at: Date | null }>(
    `SELECT id, label, created_at, last_used_at FROM mcp_tokens
     WHERE user_id = $1 AND revoked_at IS NULL ORDER BY id DESC`,
    [userId],
  );
  return res.rows.map((r) => ({
    id: r.id,
    label: r.label,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  }));
}

/** Stores the hash of a new token. null when the user already has MAX_ACTIVE_TOKENS live ones. */
export async function createToken(userId: number, tokenHash: string, label: string): Promise<number | null> {
  const res = await pool.query<{ id: number }>(
    `INSERT INTO mcp_tokens (user_id, token_hash, label)
     SELECT $1, $2, $3
     WHERE (SELECT COUNT(*) FROM mcp_tokens WHERE user_id = $1 AND revoked_at IS NULL) < $4
     RETURNING id`,
    [userId, tokenHash, label, MAX_ACTIVE_TOKENS],
  );
  return res.rows[0]?.id ?? null;
}

export async function revokeToken(userId: number, id: number): Promise<boolean> {
  const res = await pool.query(
    `UPDATE mcp_tokens SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [id, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Resolves a live token to its owner and marks it as used. null for unknown or revoked. */
export async function useToken(tokenHash: string): Promise<{ id: number; userId: number } | null> {
  const res = await pool.query<{ id: number; user_id: string }>(
    `UPDATE mcp_tokens SET last_used_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL RETURNING id, user_id`,
    [tokenHash],
  );
  const row = res.rows[0];
  return row ? { id: row.id, userId: Number(row.user_id) } : null;
}

export async function listIncomeCategories(userId: number): Promise<string[]> {
  const res = await pool.query<{ category: string }>(
    `SELECT DISTINCT category FROM transactions
     WHERE user_id = $1 AND type = 'income' AND category IS NOT NULL ORDER BY category`,
    [userId],
  );
  return res.rows.map((r) => r.category);
}

/** Inserts once per (user, external_id); a repeat returns the stored row's id with duplicate = true. */
export async function insertMcpTransaction(
  userId: number,
  item: ValidItem,
  amountGel: number | null,
): Promise<{ id: number; duplicate: boolean }> {
  const inserted = await pool.query<{ id: number }>(
    `INSERT INTO transactions (user_id, type, amount, currency, amount_gel, category, note, created_at, source, external_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()), 'mcp', $9)
     ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [
      userId,
      item.type,
      item.amount,
      item.currency,
      amountGel,
      item.category,
      item.note,
      item.createdAt,
      item.externalId,
    ],
  );
  if (inserted.rows[0]) return { id: inserted.rows[0].id, duplicate: false };
  const existing = await pool.query<{ id: number }>(
    `SELECT id FROM transactions WHERE user_id = $1 AND external_id = $2`,
    [userId, item.externalId],
  );
  return { id: existing.rows[0].id, duplicate: true };
}

interface RecentRow {
  id: number;
  type: TransactionType;
  amount: string;
  currency: SupportedCurrency;
  category: string | null;
  note: string | null;
  created_at: Date;
  source: string | null;
  external_id: string | null;
}

function toRecent(r: RecentRow): McpRecent {
  return {
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    currency: r.currency,
    category: r.category,
    note: r.note,
    createdAt: r.created_at,
    source: r.source,
    externalId: r.external_id,
  };
}

/** `onlyMcp` — the journal in the WebApp; otherwise the latest operations of any origin. */
export async function recentOperations(userId: number, limit: number, onlyMcp = false): Promise<McpRecent[]> {
  const res = await pool.query<RecentRow>(
    `SELECT id, type, amount, currency, category, note, created_at, source, external_id FROM transactions
     WHERE user_id = $1 AND ($3::boolean = FALSE OR source = 'mcp')
     ORDER BY created_at DESC, id DESC LIMIT $2`,
    [userId, limit, onlyMcp],
  );
  return res.rows.map(toRecent);
}

export async function deleteMcpTransaction(userId: number, id: number): Promise<boolean> {
  const res = await pool.query(`DELETE FROM transactions WHERE id = $1 AND user_id = $2 AND source = 'mcp'`, [
    id,
    userId,
  ]);
  return (res.rowCount ?? 0) > 0;
}

export async function saveBalance(userId: number, snap: BalanceSnapshot & { asOf: Date }): Promise<void> {
  await pool.query(
    `INSERT INTO account_balances (user_id, account, amount, currency, amount_gel, as_of)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, snap.account, snap.amount, snap.currency, snap.amountGel, snap.asOf],
  );
}

export interface StoredBalance extends BalanceSnapshot {
  asOf: Date;
}

/** The newest snapshot of each account. */
export async function latestBalances(userId: number): Promise<StoredBalance[]> {
  const res = await pool.query<{
    account: string;
    amount: string;
    currency: SupportedCurrency;
    amount_gel: string | null;
    as_of: Date;
  }>(
    `SELECT DISTINCT ON (account) account, amount, currency, amount_gel, as_of FROM account_balances
     WHERE user_id = $1 ORDER BY account, as_of DESC, id DESC`,
    [userId],
  );
  return res.rows.map((r) => ({
    account: r.account,
    amount: Number(r.amount),
    currency: r.currency,
    amountGel: r.amount_gel === null ? null : Number(r.amount_gel),
    asOf: r.as_of,
  }));
}
