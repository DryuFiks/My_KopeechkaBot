import { useState } from "react";

/** Запускает асинхронное действие формы: блокирует повторный запуск, хранит текст ошибки. */
export function useAction(onDone?: () => void) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      onDone?.();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, run };
}

/** «1 234,5» / «1234.5» → число; пустая строка → NaN, чтобы сервер отклонил её явно. */
export function parseAmount(value: string): number {
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  return cleaned === "" ? NaN : Number(cleaned);
}
