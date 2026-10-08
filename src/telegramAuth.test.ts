import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { validateInitData } from "./telegramAuth";

const TOKEN = "123:TEST";
const NOW = 1_700_000_000_000;

function sign(fields: Record<string, string>, token = TOKEN): string {
  const dcs = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dcs).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const fields = (authDate = NOW / 1000) => ({
  auth_date: String(authDate),
  query_id: "AAA",
  user: JSON.stringify({ id: 42, first_name: "Анна" }),
});

describe("validateInitData", () => {
  it("accepts correctly signed data", () => {
    expect(validateInitData(sign(fields()), TOKEN, 86400, NOW)).toEqual({ id: 42, firstName: "Анна" });
  });
  it("rejects a wrong bot token", () => {
    expect(validateInitData(sign(fields(), "other:TOKEN"), TOKEN, 86400, NOW)).toBeNull();
  });
  it("rejects tampered data", () => {
    const tampered = sign(fields()).replace("AAA", "BBB");
    expect(validateInitData(tampered, TOKEN, 86400, NOW)).toBeNull();
  });
  it("rejects stale auth_date", () => {
    expect(validateInitData(sign(fields(NOW / 1000 - 90000)), TOKEN, 86400, NOW)).toBeNull();
  });
  it("rejects missing or malformed hash and empty input", () => {
    expect(validateInitData("", TOKEN, 86400, NOW)).toBeNull();
    expect(validateInitData("auth_date=1&hash=zz", TOKEN, 86400, NOW)).toBeNull();
  });
});
