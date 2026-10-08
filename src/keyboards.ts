import { InlineKeyboard } from "grammy";

export const mainKeyboard = new InlineKeyboard()
  .text("💰 Финансы", "menu:finance")
  .text("📊 Аналитика", "menu:analytics")
  .row()
  .text("🗓 Планирование", "menu:planning")
  .text("🛠 Сервис", "menu:service");

// Telegram принимает web_app-кнопки только с https-адресом, поэтому без WEBAPP_URL кнопки нет.
const webAppUrl = process.env.WEBAPP_URL;
if (webAppUrl && webAppUrl.startsWith("https://")) {
  mainKeyboard.row().webApp("📱 WebApp", webAppUrl);
}

export const financeKeyboard = new InlineKeyboard()
  .text("➖ Расход", "action:expense")
  .text("➕ Доход", "action:income")
  .row()
  .text("🧾 История", "action:history")
  .row()
  .text("⬅️ Главное меню", "menu:main");

export const analyticsKeyboard = new InlineKeyboard()
  .text("📊 Бюджет", "action:budget")
  .text("📈 Статистика", "action:stats")
  .row()
  .text("📋 Дашборд", "action:dashboard")
  .text("📉 Тренд", "action:trend")
  .row()
  .text("💡 Шаблон бюджета", "action:budget_template")
  .row()
  .text("⬅️ Главное меню", "menu:main");

export const planningKeyboard = new InlineKeyboard()
  .text("🔁 Платежи", "action:payments")
  .text("🎯 Накопления", "action:goals")
  .row()
  .text("⬅️ Главное меню", "menu:main");

export const serviceKeyboard = new InlineKeyboard()
  .text("💱 Курсы валют", "action:rates")
  .text("📖 Все команды", "action:help")
  .row()
  .text("⚙️ Настройки", "action:settings")
  .row()
  .text("🔄 Перезапуск", "action:restart")
  .row()
  .text("⬅️ Главное меню", "menu:main");

export const cancelKeyboard = new InlineKeyboard().text("❌ Отмена", "flow:cancel");

/**
 * Appends the top-level menu grid as extra rows below an existing keyboard, so a
 * terminal screen (an undo button, a finished confirmation) still leaves an obvious
 * next action instead of stranding the user with nothing to tap but scrolling up.
 * Telegram does NOT clear a message's inline keyboard just because editMessageText
 * omits reply_markup — the old buttons would otherwise stay live and tappable, so a
 * terminal screen must always pass an explicit keyboard, never rely on the default.
 */
function withMainMenuRows(keyboard: InlineKeyboard): InlineKeyboard {
  for (const row of mainKeyboard.inline_keyboard) {
    keyboard.row(...row);
  }
  return keyboard;
}

/**
 * Categories are matched to the tapped button by index into the same array the caller
 * stored on the Flow (see handlers/textFlow.ts) — not by encoding the name itself in
 * callback_data, which could exceed Telegram's 64-byte limit for longer/Cyrillic names.
 */
export function categoryKeyboard(categories: string[]) {
  const keyboard = new InlineKeyboard();
  categories.forEach((category, index) => keyboard.text(category, `cat:${index}`).row());
  keyboard.text("Без категории", "cat:none").row().text("❌ Отмена", "flow:cancel");
  return keyboard;
}

export const confirmKeyboard = new InlineKeyboard()
  .text("✅ Сохранить", "flow:save")
  .text("❌ Отмена", "flow:cancel");

/** The specific transaction id is embedded in the callback so a duplicate tap is idempotent. */
export function undoKeyboard(transactionId: number): InlineKeyboard {
  return withMainMenuRows(new InlineKeyboard().text("↩️ Отменить", `undo:${transactionId}`));
}

/**
 * A confirmation prompt for an irreversible action. Both callbacks should embed
 * everything the handler needs (e.g. a specific row id) — not rely on separately
 * stored "pending action" state, which a second unrelated confirmation could overwrite.
 */
export function confirmActionKeyboard(yesCallback: string, noCallback: string): InlineKeyboard {
  return new InlineKeyboard().text("✅ Да", yesCallback).text("❌ Нет", noCallback);
}

/** Attached to a payment-due reminder — recording the expense always requires this explicit tap. */
export function paymentReminderKeyboard(paymentId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Записать", `payrem:${paymentId}:record`)
    .text("⏭ Не сейчас", `payrem:${paymentId}:skip`);
}

/** Prev/page-indicator/next row (only shown when there's more than one page) plus a back button. */
export function paginationKeyboard(
  callbackPrefix: string,
  page: number,
  totalPages: number,
  backCallback: string,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (totalPages > 1) {
    if (page > 0) keyboard.text("◀ Назад", `${callbackPrefix}:${page - 1}`);
    keyboard.text(`${page + 1}/${totalPages}`, "noop");
    if (page < totalPages - 1) keyboard.text("Далее ▶", `${callbackPrefix}:${page + 1}`);
    keyboard.row();
  }
  keyboard.text("⬅️ Главное меню", backCallback);
  return keyboard;
}
