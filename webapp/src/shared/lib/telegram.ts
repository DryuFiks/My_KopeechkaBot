interface BackButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TelegramWebApp {
  ready(): void;
  expand(): void;
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name: string } };
  BackButton?: BackButton;
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium"): void;
    notificationOccurred(type: "success" | "error"): void;
  };
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** Telegram WebApp SDK или undefined, если страницу открыли вне Telegram (локальная разработка). */
export function getWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

export function initTelegram(): void {
  const app = getWebApp();
  app?.ready();
  app?.expand();
  // Цвета шапки и фона берём из темы Telegram, чтобы приложение не выбивалось из интерфейса.
  app?.setHeaderColor?.("secondary_bg_color");
  app?.setBackgroundColor?.("bg_color");
}

export function getUserName(): string {
  return getWebApp()?.initDataUnsafe?.user?.first_name ?? "друг";
}

/** Лёгкая тактильная отдача; вне Telegram ничего не делает. */
export function haptic(kind: "tap" | "success" | "error"): void {
  const h = getWebApp()?.HapticFeedback;
  if (kind === "tap") h?.impactOccurred("light");
  else h?.notificationOccurred(kind);
}
