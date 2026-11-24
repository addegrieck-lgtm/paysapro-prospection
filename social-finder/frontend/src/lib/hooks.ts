import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Referentials } from './types';

export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api.get<T>(path));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

let refCache: Referentials | null = null;
export function useReferentials() {
  const [ref, setRef] = useState<Referentials | null>(refCache);
  useEffect(() => {
    if (!refCache) api.get<Referentials>('/referentials').then((r) => { refCache = r; setRef(r); }).catch(() => {});
  }, []);
  return ref;
}
