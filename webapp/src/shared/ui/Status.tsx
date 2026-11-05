import type { ReactNode } from "react";
import type { AsyncState } from "@/shared/lib/useAsync";

/** Заглушка на время загрузки: серые полосы по форме карточки вместо текста «Загрузка…» (MKB-054). */
function Skeleton() {
  return (
    <div className="skeleton" role="status" aria-live="polite" aria-label="Загрузка">
      <span />
      <span />
      <span />
    </div>
  );
}

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
  if (state.data === undefined) return <Skeleton />;
  return <>{children(state.data)}</>;
}
