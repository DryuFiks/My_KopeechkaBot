import { createHmac, timingSafeEqual } from "crypto";

export interface WebAppUser {
  id: number;
  firstName: string;
}

/**
 * Validates Telegram WebApp `initData` (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 * Pure — no DB/env — so it is unit-tested. Returns null for anything unsigned, tampered,
 * stale or malformed; the caller must treat null as "unauthenticated", never as a guess.
 */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 86400,
  nowMs = Date.now(),
): WebAppUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || nowMs / 1000 - authDate > maxAgeSec) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "") as { id?: unknown; first_name?: unknown };
    if (typeof user.id !== "number" || !Number.isSafeInteger(user.id)) return null;
    return { id: user.id, firstName: typeof user.first_name === "string" ? user.first_name : "" };
  } catch {
    return null;
  }
}
