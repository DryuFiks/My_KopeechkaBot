interface TelegramWebApp {
  ready(): void;
  expand(): void;
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name: string } };
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
}

export function getUserName(): string {
  return getWebApp()?.initDataUnsafe?.user?.first_name ?? "друг";
}
