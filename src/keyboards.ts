import { InlineKeyboard, Keyboard } from "grammy";
export const mainKeyboard = new Keyboard()
  .text("➖ Расход").text("➕ Доход").row()
  .text("📊 Бюджет").text("🧾 История").row()
  .text("🔁 Платежи").text("🎯 Накопления").row()
  .text("📈 Статистика").text("⚙️ Настройки").row()
  .text("🔄 Перезапуск").resized();
export const cancelKeyboard = new Keyboard().text("❌ Отмена").resized();
export function categoryKeyboard(type: "expense" | "income", categories: string[]) {
  const kb = new InlineKeyboard();
  for (const category of categories) kb.text(category, `cat:${type}:${category}`).row();
  kb.text("Без категории", `cat:${type}:_`).row().text("Отмена", "flow:cancel");
  return kb;
}
export const confirmKeyboard = new InlineKeyboard().text("✅ Сохранить", "flow:save").text("❌ Отмена", "flow:cancel");
