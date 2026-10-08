import { useCallback, useEffect, useState } from "react";

export interface AsyncState<T> {
  data?: T;
  error?: string;
  loading: boolean;
  reload: () => void;
}

export function useAsync<T>(load: () => Promise<T>): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load()
      .then((d) => alive && (setData(d), setError(undefined)))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { data, error, loading, reload: useCallback(() => setTick((t) => t + 1), []) };
}
