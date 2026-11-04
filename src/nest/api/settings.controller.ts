import { BadRequestException, Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { isValidExchangeFactor } from "../../currencies";
import { eraseUserData } from "../../db/eraseUser";
import { getUserSettings, updateUserSettings, type UserSettings } from "../../db/settings";
import { REMIND_HOURS } from "../../eveningReminder";
import type { WebAppUser } from "../../telegramAuth";
import { TelegramAuthGuard, WebUser } from "./auth.guard";
import { currency } from "./validation";

function present(s: Awaited<ReturnType<typeof getUserSettings>>) {
  return {
    displayCurrency: s.displayCurrency,
    exchangeFactor: s.exchangeFactor,
    timezone: s.timezone,
    onboarded: s.onboardedAt !== null,
    remindEvening: s.remindEvening,
    remindHour: s.remindHour,
    weeklyDigest: s.weeklyDigest,
  };
}

@Controller("api")
@UseGuards(TelegramAuthGuard)
export class SettingsController {
  @Get("settings")
  async get(@WebUser() user: WebAppUser) {
    return present(await getUserSettings(user.id));
  }

  /** Main currency, exchanger factor, evening reminder and weekly digest; omitted fields stay as they are. */
  @Put("settings")
  async update(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    const patch: Partial<UserSettings> = {};
    if (body.displayCurrency !== undefined) patch.displayCurrency = currency(body.displayCurrency);
    if (body.exchangeFactor !== undefined) {
      const factor = Number(body.exchangeFactor);
      if (!isValidExchangeFactor(factor)) throw new BadRequestException("invalid factor");
      patch.exchangeFactor = Math.round(factor * 1000) / 1000;
    }
    for (const key of ["remindEvening", "weeklyDigest"] as const) {
      if (body[key] === undefined) continue;
      if (typeof body[key] !== "boolean") throw new BadRequestException(`invalid ${key}`);
      patch[key] = body[key];
    }
    if (body.remindHour !== undefined) {
      if (!REMIND_HOURS.includes(Number(body.remindHour)))
        throw new BadRequestException("invalid remindHour");
      patch.remindHour = Number(body.remindHour);
    }
    return present(await updateUserSettings(user.id, patch));
  }

  @Post("onboarding/complete")
  async complete(@WebUser() user: WebAppUser) {
    return present(await updateUserSettings(user.id, { onboardedAt: new Date() }));
  }

  /** Erases all of the caller's data (user id from signed initData only); `confirm: true` guards against stray calls. */
  @Post("account/erase")
  async erase(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    if (body.confirm !== true) throw new BadRequestException("confirmation required");
    return { removed: await eraseUserData(user.id) };
  }

  @Post("onboarding/reset")
  async reset(@WebUser() user: WebAppUser) {
    return present(await updateUserSettings(user.id, { onboardedAt: null }));
  }
}
