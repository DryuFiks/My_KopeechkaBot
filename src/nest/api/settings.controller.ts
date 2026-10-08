import { BadRequestException, Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { isValidExchangeFactor } from "../../currencies";
import { getUserSettings, updateUserSettings } from "../../db/settings";
import type { WebAppUser } from "../../telegramAuth";
import { TelegramAuthGuard, WebUser } from "./auth.guard";
import { currency } from "./validation";

function present(s: Awaited<ReturnType<typeof getUserSettings>>) {
  return {
    displayCurrency: s.displayCurrency,
    exchangeFactor: s.exchangeFactor,
    timezone: s.timezone,
    onboarded: s.onboardedAt !== null,
  };
}

@Controller("api")
@UseGuards(TelegramAuthGuard)
export class SettingsController {
  @Get("settings")
  async get(@WebUser() user: WebAppUser) {
    return present(await getUserSettings(user.id));
  }

  /** Main (display) currency and the exchanger factor; omitted fields stay as they are. */
  @Put("settings")
  async update(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    const patch: { displayCurrency?: ReturnType<typeof currency>; exchangeFactor?: number } = {};
    if (body.displayCurrency !== undefined) patch.displayCurrency = currency(body.displayCurrency);
    if (body.exchangeFactor !== undefined) {
      const factor = Number(body.exchangeFactor);
      if (!isValidExchangeFactor(factor)) throw new BadRequestException("invalid factor");
      patch.exchangeFactor = Math.round(factor * 1000) / 1000;
    }
    return present(await updateUserSettings(user.id, patch));
  }

  @Post("onboarding/complete")
  async complete(@WebUser() user: WebAppUser) {
    return present(await updateUserSettings(user.id, { onboardedAt: new Date() }));
  }

  @Post("onboarding/reset")
  async reset(@WebUser() user: WebAppUser) {
    return present(await updateUserSettings(user.id, { onboardedAt: null }));
  }
}
