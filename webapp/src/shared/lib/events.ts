/** Крошечная шина событий: слои не импортируют друг друга, а общаются через неё. */
export interface Bus<T> {
  on(listener: (value: T) => void): () => void;
  emit(value: T): void;
}

export function createBus<T>(): Bus<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    on(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(value) {
      // Копия набора: слушатель может отписаться прямо во время рассылки.
      [...listeners].forEach((l) => l(value));
    },
  };
}

/** Любая успешная запись на сервер (POST/PUT/DELETE) — повод перепроверить награды. */
export const writeBus = createBus<void>();
