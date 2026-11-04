import { useEffect, useState } from "react";
import { Hint, Icon } from "@/shared/ui";
import { addToHomeScreen, homeScreenStatus, type HomeScreenStatus } from "@/shared/lib/telegram";

/**
 * «Добавить на главный экран» (MKB-061): ярлык открывает Копеечку одним тапом, без поиска чата с ботом.
 * Показывается только там, где клиент Telegram это умеет (Bot API 8.0+) и ярлыка ещё нет.
 */
export function HomeScreenShortcut() {
  const [status, setStatus] = useState<HomeScreenStatus>("unsupported");
  useEffect(() => {
    void homeScreenStatus().then(setStatus);
  }, []);
  if (status !== "missed" && status !== "unknown") return null;
  return (
    <section className="card">
      <h2 className="card__title">Ярлык на главный экран</h2>
      <Hint>Копеечка будет открываться с главного экрана телефона одним нажатием — как обычное приложение.</Hint>
      <button
        className="primary wide"
        onClick={() => {
          addToHomeScreen();
          // Клиент сам покажет системный диалог; повторно предлагать не нужно.
          setStatus("added");
        }}
      >
        <Icon name="home" /> Добавить на главный экран
      </button>
    </section>
  );
}
