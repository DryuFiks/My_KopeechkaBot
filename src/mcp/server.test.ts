import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { methodNotAllowed, serveMcpPost } from "./http";
import { RateLimiter, type BalanceSnapshot, type ValidItem } from "./rules";
import { createMcpServer, type McpContext, type McpDeps, type McpRecent } from "./server";

const USER = 42;

/** In-memory stand-in for the database: the same contract as src/mcp/deps.ts. */
function fakeDeps() {
  const rows: (McpRecent & { userId: number; amountGel: number | null })[] = [];
  const balances: (BalanceSnapshot & { userId: number; asOf: Date })[] = [];
  let nextId = 1;
  const deps: McpDeps = {
    now: () => new Date("2026-11-16T10:00:00Z"),
    getSettings: async () => ({ timezone: "Asia/Tbilisi", exchangeFactor: 1 }),
    listCategories: async (_u, type) => (type === "expense" ? ["Еда", "Транспорт"] : ["Зарплата"]),
    toGel: async (amount, currency) =>
      currency === "GEL" ? amount : currency === "USD" ? amount * 2.7 : null,
    insertTransaction: async (userId: number, item: ValidItem, amountGel) => {
      const dup =
        item.externalId && rows.find((r) => r.userId === userId && r.externalId === item.externalId);
      if (dup) return { id: dup.id, duplicate: true };
      const id = nextId++;
      rows.push({
        id,
        userId,
        type: item.type,
        amount: item.amount,
        currency: item.currency,
        category: item.category,
        note: item.note,
        createdAt: item.createdAt ?? new Date("2026-11-16T10:00:00Z"),
        source: "mcp",
        externalId: item.externalId,
        amountGel,
      });
      return { id, duplicate: false };
    },
    recent: async (userId, limit) =>
      rows
        .filter((r) => r.userId === userId)
        .slice(-limit)
        .reverse(),
    deleteMcpTransaction: async (userId, id) => {
      const i = rows.findIndex((r) => r.id === id && r.userId === userId && r.source === "mcp");
      if (i < 0) return false;
      rows.splice(i, 1);
      return true;
    },
    saveBalance: async (userId, snap) => void balances.push({ ...snap, userId }),
    latestBalances: async (userId) => {
      const latest = new Map<string, BalanceSnapshot>();
      for (const b of balances.filter((x) => x.userId === userId)) latest.set(b.account, b);
      return [...latest.values()];
    },
    calculatedBalanceGel: async (userId) =>
      rows
        .filter((r) => r.userId === userId)
        .reduce((sum, r) => sum + (r.amountGel ?? 0) * (r.type === "income" ? 1 : -1), 0),
  };
  return { deps, rows, balances };
}

const ctxFor = (limiter = new RateLimiter()): McpContext => ({ userId: USER, limitKey: "t1", limiter });

/** Calls a tool and parses the JSON text the server returns. */
async function call(client: Client, name: string, args: Record<string, unknown>) {
  const res = (await client.callTool({ name, arguments: args })) as {
    content: { type: string; text: string }[];
    isError?: boolean;
  };
  return { data: JSON.parse(res.content[0].text), isError: res.isError === true };
}

describe("MCP protocol (Client ↔ McpServer, in memory)", () => {
  let client: Client;
  let store: ReturnType<typeof fakeDeps>;

  async function connect(limiter?: RateLimiter) {
    store = fakeDeps();
    const server = createMcpServer(store.deps, ctxFor(limiter));
    const [a, b] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-agent", version: "1" });
    await Promise.all([server.connect(a), client.connect(b)]);
  }
  beforeEach(() => connect());

  it("announces the tools an agent needs", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "add_transactions",
      "delete_transaction",
      "get_recent",
      "list_categories",
      "report_balance",
    ]);
    expect(client.getInstructions()).toContain("external_id");
  });

  it("lists categories per type", async () => {
    expect((await call(client, "list_categories", {})).data.categories).toEqual(["Еда", "Транспорт"]);
    expect((await call(client, "list_categories", { type: "income" })).data.categories).toEqual(["Зарплата"]);
  });

  it("records a bank statement and reports a status per line", async () => {
    const { data } = await call(client, "add_transactions", {
      items: [
        {
          type: "expense",
          amount: 15.2,
          currency: "GEL",
          category: "Еда",
          note: "Carrefour",
          external_id: "b-1",
          date: "2026-11-14",
        },
        { type: "expense", amount: 10, currency: "USD", note: "Steam", external_id: "b-2" },
        { type: "income", amount: 3000, currency: "GEL", category: "Зарплата", external_id: "b-3" },
      ],
    });
    expect(data.summary).toEqual({ created: 3, duplicate: 0, error: 0 });
    expect(data.results[1].amount_gel).toBe(27);
    expect(store.rows).toHaveLength(3);
    expect(store.rows[0]).toMatchObject({ source: "mcp", category: "Еда", externalId: "b-1" });
  });

  it("does not duplicate when the same statement is sent twice", async () => {
    const items = [
      { type: "expense", amount: 5, currency: "GEL", external_id: "b-1" },
      { type: "expense", amount: 7, currency: "GEL", external_id: "b-2" },
    ];
    const first = await call(client, "add_transactions", { items });
    const second = await call(client, "add_transactions", { items });
    expect(second.data.summary).toEqual({ created: 0, duplicate: 2, error: 0 });
    expect(second.data.results.map((r: { id: number }) => r.id)).toEqual(
      first.data.results.map((r: { id: number }) => r.id),
    );
    expect(store.rows).toHaveLength(2);
  });

  it("a bad line does not sink the good ones", async () => {
    const { data } = await call(client, "add_transactions", {
      items: [
        { type: "expense", amount: 5, currency: "GEL", category: "Яхты" },
        { type: "expense", amount: 6, currency: "EUR" },
        { type: "expense", amount: 7, currency: "GEL", external_id: "ok" },
      ],
    });
    expect(data.summary).toEqual({ created: 1, duplicate: 0, error: 2 });
    expect(data.results[0].error).toContain("list_categories");
    expect(data.results[1].error).toContain("currency");
    expect(store.rows).toHaveLength(1);
  });

  it("a currency without a rate is stored without a GEL value, not guessed", async () => {
    store.deps.toGel = async () => null;
    const { data } = await call(client, "add_transactions", {
      items: [{ type: "expense", amount: 5, currency: "RUB" }],
    });
    expect(data.results[0]).toMatchObject({ status: "created", amount_gel: null });
  });

  it("refuses an oversized batch at the schema level", async () => {
    const items = Array.from({ length: 51 }, () => ({ type: "expense", amount: 1, currency: "GEL" }));
    // Depending on the SDK version the schema error is thrown or returned as isError.
    const rejected = await client
      .callTool({ name: "add_transactions", arguments: { items } })
      .then((r) => r.isError === true)
      .catch(() => true);
    expect(rejected).toBe(true);
    expect(store.rows).toHaveLength(0);
  });

  it("limits how many records one token writes per minute", async () => {
    await connect(new RateLimiter(3, 60_000));
    const three = Array.from({ length: 3 }, (_, i) => ({
      type: "expense",
      amount: 1,
      currency: "GEL",
      external_id: `a${i}`,
    }));
    expect((await call(client, "add_transactions", { items: three })).isError).toBe(false);
    const more = await call(client, "add_transactions", {
      items: [{ type: "expense", amount: 1, currency: "GEL" }],
    });
    expect(more.isError).toBe(true);
    expect(more.data.error).toContain("rate limit");
    expect(store.rows).toHaveLength(3);
  });

  it("reconciles the bank balance with the bot's own", async () => {
    await call(client, "add_transactions", {
      items: [
        { type: "income", amount: 1000, currency: "GEL", category: "Зарплата" },
        { type: "expense", amount: 200, currency: "GEL" },
      ],
    });
    const off = await call(client, "report_balance", { account: "TBC", amount: 850, currency: "GEL" });
    expect(off.data.reconciliation).toMatchObject({
      bank_total_gel: 850,
      bot_balance_gel: 800,
      difference_gel: 50,
      matches: false,
    });
    const on = await call(client, "report_balance", { account: "TBC", amount: 800, currency: "GEL" });
    expect(on.data.reconciliation).toMatchObject({ difference_gel: 0, matches: true });
    expect(store.balances).toHaveLength(2); // snapshots are kept, only the newest counts
  });

  it("sums several accounts and rejects bad balance input", async () => {
    await call(client, "report_balance", { account: "TBC", amount: 100, currency: "GEL" });
    const two = await call(client, "report_balance", { account: "USD card", amount: 10, currency: "USD" });
    expect(two.data.reconciliation.bank_total_gel).toBe(127);
    expect((await call(client, "report_balance", { account: " ", amount: 1, currency: "GEL" })).isError).toBe(
      true,
    );
    expect((await call(client, "report_balance", { account: "x", amount: 1, currency: "EUR" })).isError).toBe(
      true,
    );
    expect(
      (
        await call(client, "report_balance", {
          account: "x",
          amount: 1,
          currency: "GEL",
          as_of: "2030-01-01",
        })
      ).isError,
    ).toBe(true);
  });

  it("shows recent operations and undoes only MCP ones", async () => {
    const { data } = await call(client, "add_transactions", {
      items: [{ type: "expense", amount: 9, currency: "GEL", note: "taxi" }],
    });
    const id = data.results[0].id;
    expect((await call(client, "get_recent", {})).data.items[0]).toMatchObject({
      id,
      note: "taxi",
      source: "mcp",
    });

    store.rows.push({ ...store.rows[0], id: 999, source: null, externalId: null });
    expect((await call(client, "delete_transaction", { id: 999 })).isError).toBe(true);
    expect((await call(client, "delete_transaction", { id })).data).toEqual({ deleted: true });
    expect((await call(client, "delete_transaction", { id })).isError).toBe(true);
  });

  it("never touches another user's rows", async () => {
    const { data } = await call(client, "add_transactions", {
      items: [{ type: "expense", amount: 9, currency: "GEL" }],
    });
    store.rows[0].userId = 7; // belongs to someone else
    expect((await call(client, "delete_transaction", { id: data.results[0].id })).isError).toBe(true);
    expect((await call(client, "get_recent", {})).data.items).toEqual([]);
  });
});

describe("MCP over HTTP (Streamable HTTP, like Claude / ChatGPT / Cherry Studio)", () => {
  let http: Server;
  let url: URL;
  let store: ReturnType<typeof fakeDeps>;
  const limiter = new RateLimiter();

  beforeAll(async () => {
    store = fakeDeps();
    http = createServer((req, res) => {
      if (req.method !== "POST") return methodNotAllowed(res);
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => void serveMcpPost(req, res, JSON.parse(raw), store.deps, ctxFor(limiter)));
    });
    await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
    url = new URL(`http://127.0.0.1:${(http.address() as AddressInfo).port}/mcp/token`);
  });
  afterAll(() => new Promise<void>((r) => http.close(() => r())));

  it("an agent can connect, discover tools and add an expense", async () => {
    const client = new Client({ name: "http-agent", version: "1" });
    await client.connect(new StreamableHTTPClientTransport(url));
    const { tools } = await client.listTools();
    expect(tools.some((t) => t.name === "add_transactions")).toBe(true);

    const { data } = await call(client, "add_transactions", {
      items: [{ type: "expense", amount: 4.5, currency: "GEL", note: "кофе", external_id: "http-1" }],
    });
    expect(data.summary.created).toBe(1);
    expect(store.rows[0]).toMatchObject({ note: "кофе", source: "mcp" });
    await client.close();
  });

  it("answers 405 to GET so clients fall back to plain request/response", async () => {
    const res = await fetch(url);
    expect(res.status).toBe(405);
  });
});
