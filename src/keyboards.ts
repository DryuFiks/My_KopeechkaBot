import { InlineKeyboard } from "grammy";

export const mainKeyboard = new InlineKeyboard()
  .text("💰 Финансы", "menu:finance")
  .text("📊 Аналитика", "menu:analytics")
  .row()
  .text("🗓 Планирование", "menu:planning")
  .text("🛠 Сервис", "menu:service");

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
 * Telegram does NOT clear a message's inline keyboard just because editMessageText
 * omits reply_markup — the old buttons stay live and tappable. Pass this explicitly
 * whenever a scenario has ended, so a stale "✅ Да / ❌ Нет" or "Сохранить" can't be
 * tapped again after the action it belonged to is already done.
 */
export const emptyKeyboard = new InlineKeyboard();

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
  return new InlineKeyboard().text("↩️ Отменить", `undo:${transactionId}`);
}

/**
 * A confirmation prompt for an irreversible action. Both callbacks should embed
 * everything the handler needs (e.g. a specific row id) — not rely on separately
 * stored "pending action" state, which a second unrelated confirmation could overwrite.
 */
export function confirmActionKeyboard(yesCallback: string, noCallback: string): InlineKeyboard {
  return new InlineKeyboard().text("✅ Да", yesCallback).text("❌ Нет", noCallback);
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
