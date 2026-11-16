// Pure token helpers for MCP links (MKB-063) — no DB. Only the sha256 of a token is ever stored.

import { createHash, randomBytes } from "crypto";

export const TOKEN_PREFIX = "kb_mcp_";

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cheap shape check before touching the DB: random junk in the URL never causes a query. */
export function isTokenShape(value: unknown): value is string {
  return typeof value === "string" && /^kb_mcp_[A-Za-z0-9_-]{43}$/.test(value);
}
