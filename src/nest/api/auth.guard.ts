import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import type { Request } from "express";
import { validateInitData, type WebAppUser } from "../../telegramAuth";

export const INIT_DATA_HEADER = "x-telegram-init-data";

type AuthedRequest = Request & { webAppUser?: WebAppUser };

/** Every guarded /api route requires signed Telegram initData; the user id comes ONLY from it. */
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const raw = req.headers[INIT_DATA_HEADER];
    const token = process.env.BOT_TOKEN;
    const user = typeof raw === "string" && token ? validateInitData(raw, token) : null;
    if (!user) throw new UnauthorizedException();
    req.webAppUser = user;
    return true;
  }
}

export const WebUser = createParamDecorator((_: unknown, ctx: ExecutionContext): WebAppUser => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().webAppUser as WebAppUser;
});
