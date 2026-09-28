import { InlineKeyboard } from "grammy";
import type { PeriodUnit } from "../period";

const UNIT_LABEL: Record<PeriodUnit, string> = {
  month: "Месяц",
  quarter: "Квартал",
  year: "Год",
};

/**
 * ◀/▶ moves within the current unit (▶ hidden once back at the current period — no
 * browsing into the future); the bottom row switches the unit, always resetting to
 * offset 0. Shared by the dashboard (MKB-009) and the trend chart (MKB-010).
 */
export function periodSwitchKeyboard(
  callbackPrefix: string,
  unit: PeriodUnit,
  offset: number,
  backCallback: string,
): InlineKeyboard {
  const keyboard = new InlineKeyboard().text("◀", `${callbackPrefix}:${unit}:${offset - 1}`);
  if (offset < 0) keyboard.text("▶", `${callbackPrefix}:${unit}:${offset + 1}`);
  keyboard.row();
  for (const candidate of Object.keys(UNIT_LABEL) as PeriodUnit[]) {
    const label = candidate === unit ? `• ${UNIT_LABEL[candidate]}` : UNIT_LABEL[candidate];
    keyboard.text(label, `${callbackPrefix}:${candidate}:0`);
  }
  return keyboard.row().text("⬅️ Главное меню", backCallback);
}
