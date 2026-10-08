import { getWebApp, haptic } from "@/shared/lib/telegram";

/** Человекочитаемая причина по статусу ответа; тексты сервера пользователю не показываем. */
export function errorMessage(status: number): string {
  if (status === 401) return "Откройте приложение из Telegram";
  if (status === 400) return "Проверьте введённые данные";
  if (status === 404) return "Запись не найдена";
  return `Ошибка ${status}`;
}

/** Подписанные Telegram-ом initData — сервер берёт user id только из них. */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isWrite = method !== "GET";
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-telegram-init-data": getWebApp()?.initData ?? "",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    if (isWrite) haptic("error");
    throw new Error("Нет соединения");
  }
  if (!res.ok) {
    if (isWrite) haptic("error");
    throw new Error(errorMessage(res.status));
  }
  if (isWrite) haptic("success");
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
