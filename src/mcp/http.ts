// One MCP request over Streamable HTTP, stateless: a fresh server + transport per POST, JSON replies
// (no SSE), so nothing is kept in memory between calls and a restart loses nothing. MKB-063.

import type { IncomingMessage, ServerResponse } from "http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer, type McpContext, type McpDeps } from "./server";

export async function serveMcpPost(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  deps: McpDeps,
  ctx: McpContext,
): Promise<void> {
  const server = createMcpServer(deps, ctx);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

/** GET (event stream) and DELETE (end session) make no sense without sessions. */
export function methodNotAllowed(res: ServerResponse): void {
  res.writeHead(405, { "content-type": "application/json", allow: "POST" });
  res.end(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null }),
  );
}
