import { All, Controller, Param, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { useToken } from "../db/mcp";
import { dbDeps } from "../mcp/deps";
import { methodNotAllowed, serveMcpPost } from "../mcp/http";
import { RateLimiter } from "../mcp/rules";
import { hashToken, isTokenShape } from "../mcp/tokens";

/**
 * MKB-063: the MCP endpoint for AI agents. The secret link IS the credential, so there is no
 * Telegram guard here: the token resolves to exactly one user and the user id never comes from
 * the request. Wrong, malformed and revoked tokens all get the same bare 401.
 */
@Controller("mcp")
export class McpController {
  private readonly limiter = new RateLimiter();

  @All(":token")
  async handle(@Param("token") token: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const owner = isTokenShape(token) ? await useToken(hashToken(token)) : null;
    if (!owner) {
      res.status(401).json({ error: "invalid token" });
      return;
    }
    if (req.method !== "POST") {
      methodNotAllowed(res);
      return;
    }
    await serveMcpPost(req, res, req.body, dbDeps, {
      userId: owner.userId,
      limitKey: String(owner.id),
      limiter: this.limiter,
    });
  }
}
