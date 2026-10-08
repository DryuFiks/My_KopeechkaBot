import type { ReactNode } from "react";
import type { AsyncState } from "@/shared/lib/useAsync";

/** Единое поведение загрузки/ошибки: страница рисует содержимое только при готовых данных. */
export function Status<T>({ state, children }: { state: AsyncState<T>; children: (data: T) => ReactNode }) {
  if (state.error) return <p className="hint">{state.error}</p>;
  if (state.data === undefined) return <p className="hint">Загрузка…</p>;
  return <>{children(state.data)}</>;
}
