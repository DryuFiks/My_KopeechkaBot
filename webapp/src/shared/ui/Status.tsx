import type { ReactNode } from "react";
import type { AsyncState } from "@/shared/lib/useAsync";

/** Единое поведение загрузки/ошибки: страница рисует содержимое только при готовых данных. */
export function Status<T>({ state, children }: { state: AsyncState<T>; children: (data: T) => ReactNode }) {
  if (state.error) {
    return (
      <div role="alert">
        <p className="hint">{state.error}</p>
        <button className="chip" onClick={state.reload}>
          Повторить
        </button>
      </div>
    );
  }
  if (state.data === undefined) {
    return (
      <p className="hint" role="status" aria-live="polite">
        Загрузка…
      </p>
    );
  }
  return <>{children(state.data)}</>;
}
