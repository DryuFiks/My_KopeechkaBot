import { InlineKeyboard, Keyboard } from "grammy";

const backButton = "⬅️ Главное меню";

export const mainKeyboard = new Keyboard()
  .text("💰 Финансы").text("📊 Аналитика").row()
  .text("🗓 Планирование").text("🛠 Сервис")
  .resized();

export const financeKeyboard = new Keyboard()
  .text("➖ Расход").text("➕ Доход").row()
  .text("🧾 История").row()
  .text(backButton)
  .resized();

export const analyticsKeyboard = new Keyboard()
  .text("📊 Бюджет").text("📈 Статистика").row()
  .text(backButton)
  .resized();

export const planningKeyboard = new Keyboard()
  .text("🔁 Платежи").text("🎯 Накопления").row()
  .text(backButton)
  .resized();

export const serviceKeyboard = new Keyboard()
  .text("💱 Курсы валют").text("📖 Все команды").row()
  .text("⚙️ Настройки").row()
  .text("🔄 Перезапуск").row()
  .text(backButton)
  .resized();

export const cancelKeyboard = new Keyboard().text("❌ Отмена").resized();

export function categoryKeyboard(type: "expense" | "income", categories: string[]) {
  const keyboard = new InlineKeyboard();
  for (const category of categories) keyboard.text(category, `cat:${type}:${category}`).row();
  keyboard.text("Без категории", `cat:${type}:_`).row().text("Отмена", "flow:cancel");
  return keyboard;
}

export const confirmKeyboard = new InlineKeyboard()
  .text("✅ Сохранить", "flow:save")
  .text("❌ Отмена", "flow:cancel");
