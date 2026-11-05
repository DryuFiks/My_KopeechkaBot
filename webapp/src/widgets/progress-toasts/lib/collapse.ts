const MAX_TOASTS = 2;

/**
 * Не больше двух тостов разом (MKB-054): при первом входе наград может открыться сразу десяток,
 * и они закрывали весь экран. Первая — как есть, остальные — одной строкой со ссылкой на Профиль.
 */
export function collapseToasts(texts: string[]): string[] {
  if (texts.length <= MAX_TOASTS) return texts;
  return [texts[0], `🏅 И ещё ${texts.length - 1} — все награды в Профиле`];
}
