/** Секретная ссылка на MCP-сервер: тот же origin, что и мини-приложение, путь /mcp/<токен>. */
export function mcpUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/mcp/${token}`;
}

/** «Claude», «ChatGPT» и т. п. → подпись для списка; пустое имя не принимаем. */
export function cleanLabel(value: string): string | null {
  const label = value.trim().replace(/\s+/g, " ");
  return label === "" ? null : label.slice(0, 40);
}

/** Подпись под токеном в списке: когда создан и когда агент последний раз заходил. */
export function tokenUsage(createdAt: string, lastUsedAt: string | null): string {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return lastUsedAt ? `создана ${fmt(createdAt)}, последний вызов ${fmt(lastUsedAt)}` : `создана ${fmt(createdAt)}, ещё не использовалась`;
}
