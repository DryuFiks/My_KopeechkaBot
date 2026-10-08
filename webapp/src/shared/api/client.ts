import { getWebApp } from "@/shared/lib/telegram";

/** Подписанные Telegram-ом initData — сервер берёт user id только из них. */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-telegram-init-data": getWebApp()?.initData ?? "",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.status === 401 ? "Откройте приложение из Telegram" : `Ошибка ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
