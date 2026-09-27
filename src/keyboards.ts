import { InlineKeyboard, Keyboard } from "grammy";
export const mainKeyboard = new Keyboard()
  .text("💰 Финансы").text("📊 Аналитика").row()
  .text("🗓 Планирование").text("🛠 Сервис").row()
  .text("➖ Расход").text("➕ Доход").row()
  .text("📊 Бюджет").text("📈 Статистика").row()
  .text("🧾 История").text("🔁 Платежи").row()
  .text("🎯 Накопления").text("💱 Курсы валют").row()
  .text("📖 Все команды").text("⚙️ Настройки").row()
  .text("🔄 Перезапуск").resized();
export const cancelKeyboard = new Keyboard().text("❌ Отмена").resized();
export function categoryKeyboard(type: "expense" | "income", categories: string[]) {
  const kb = new InlineKeyboard();
  for (const category of categories) kb.text(category, `cat:${type}:${category}`).row();
  kb.text("Без категории", `cat:${type}:_`).row().text("Отмена", "flow:cancel");
  return kb;
}
export const confirmKeyboard = new InlineKeyboard().text("✅ Сохранить", "flow:save").text("❌ Отмена", "flow:cancel");
