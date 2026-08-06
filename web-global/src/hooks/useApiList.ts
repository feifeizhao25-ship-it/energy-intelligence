'use client';

/**
 * useApiList — fetch a list resource client-side and expose a three-state
 * result. 'unavailable' means the request failed or the payload shape was
 * unrecognized; 'ready' carries whatever the backend returned (possibly an
 * empty list). No fabricated fallback.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_BASE, extractList, fetchJson } from '../lib/config';

export interface ApiListState {
  state: 'loading' | 'ready' | 'unavailable';
  rows: Record<string, unknown>[];
  reload: () => void;
}

export function useApiList(path: string): ApiListState {
  const [state, setState] = useState<ApiListState['state']>('loading');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const payload = await fetchJson(`${API_BASE}${path}`);
      const list = extractList(payload);
      if (!list) throw new Error('unrecognized payload');
      setRows(list);
      setState('ready');
    } catch {
      setRows([]);
      setState('unavailable');
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, rows, reload: () => void load() };
}

export default useApiList;
