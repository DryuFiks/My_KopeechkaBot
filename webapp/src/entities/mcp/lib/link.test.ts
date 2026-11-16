import { describe, expect, it } from "vitest";
import { cleanLabel, mcpUrl, tokenUsage } from "./link";

describe("mcpUrl", () => {
  it("joins origin and token without a double slash", () => {
    expect(mcpUrl("https://x.example", "kb_mcp_abc")).toBe("https://x.example/mcp/kb_mcp_abc");
    expect(mcpUrl("https://x.example/", "kb_mcp_abc")).toBe("https://x.example/mcp/kb_mcp_abc");
  });
});

describe("cleanLabel", () => {
  it("trims, collapses spaces and caps the length", () => {
    expect(cleanLabel("  Claude   Desktop ")).toBe("Claude Desktop");
    expect(cleanLabel("x".repeat(60))).toHaveLength(40);
  });
  it("rejects an empty name", () => {
    expect(cleanLabel("   ")).toBeNull();
  });
});

describe("tokenUsage", () => {
  it("says so when the link was never used", () => {
    expect(tokenUsage("2026-11-10T10:00:00Z", null)).toContain("ещё не использовалась");
  });
  it("mentions the last call otherwise", () => {
    expect(tokenUsage("2026-11-10T10:00:00Z", "2026-11-12T10:00:00Z")).toContain("последний вызов");
  });
});
