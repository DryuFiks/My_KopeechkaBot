import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { Api } from "grammy";
import { trackEvent } from "../../db/events";
import { submitFeedback } from "../../feedback";
import type { WebAppUser } from "../../telegramAuth";
import { TelegramAuthGuard, WebUser } from "./auth.guard";

/** MKB-047: WebApp opens (for retention metrics) and feedback to the developer. */
@Controller("api")
@UseGuards(TelegramAuthGuard)
export class EventsController {
  private api?: Api;

  @Post("app-open")
  appOpen(@WebUser() user: WebAppUser) {
    trackEvent(user.id, "app_open", "webapp");
    return { ok: true };
  }

  @Post("feedback")
  async feedback(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    this.api ??= new Api(process.env.BOT_TOKEN ?? "");
    const result = await submitFeedback(this.api, { id: user.id, name: user.firstName }, body.text, "webapp");
    if (result === "empty" || result === "too_long") throw new BadRequestException(result);
    if (result === "too_soon") throw new HttpException("too soon", HttpStatus.TOO_MANY_REQUESTS);
    if (result === "unavailable") throw new ServiceUnavailableException();
    return { sent: true };
  }
}
