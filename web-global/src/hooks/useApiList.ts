'use client';

/**
 * useApiList — fetch a list resource client-side and expose a three-state
 * result. 'unavailable' means the request failed or the payload shape was
 * unrecognized; 'ready' carries whatever the backend returned (possibly an
 * empty list). No fabricated fallback.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_BASE, HttpStatusError, extractList, fetchJson } from '../lib/config';
import { failureFromStatus, type FetchFailure } from '../lib/service-notice';

export interface ApiListState {
  state: 'loading' | 'ready' | 'unavailable';
  failure: FetchFailure | null;
  rows: Record<string, unknown>[];
  reload: () => void;
}

export function useApiList(path: string): ApiListState {
  const [state, setState] = useState<ApiListState['state']>('loading');
  const [failure, setFailure] = useState<FetchFailure | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const payload = await fetchJson(`${API_BASE}${path}`);
      const list = extractList(payload);
      if (!list) throw new Error('unrecognized payload');
      setFailure(null);
      setRows(list);
      setState('ready');
    } catch (error) {
      setRows([]);
      setFailure(error instanceof HttpStatusError ? failureFromStatus(error.status) : 'offline');
      setState('unavailable');
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, failure, rows, reload: () => void load() };
}

export default useApiList;
