'use client';

/**
 * usePersonalizedDashboard — fetch the personalized hero banner and widget
 * layout for a user. Returns null payloads when the backend has no
 * personalization data; callers must render a neutral default in that case.
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002').replace(/\/$/, '');

export interface HeroPayload {
  headline?: string;
  subline?: string;
  metrics?: Array<{ label: string; value: string }>;
}

export interface DashboardWidget {
  id: string;
  kind: string;
  order: number;
}

export interface PersonalizedDashboardState {
  hero: HeroPayload | null;
  widgets: DashboardWidget[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePersonalizedDashboard(userId: string | null): PersonalizedDashboardState {
  const [hero, setHero] = useState<HeroPayload | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setHero(null);
      setWidgets([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const uid = encodeURIComponent(userId);
      const dayNum = new Date().getDay();
      const [heroRes, widgetsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/personalize/hero/${uid}?day=${dayNum}`),
        fetch(`${API_BASE}/api/v1/personalize/widgets/${uid}`),
      ]);
      if (!heroRes.ok || !widgetsRes.ok) {
        throw new Error(`personalization backend returned ${heroRes.status}/${widgetsRes.status}`);
      }
      setHero((await heroRes.json()) as HeroPayload);
      const widgetPayload = (await widgetsRes.json()) as { widgets?: DashboardWidget[] };
      setWidgets(
        (widgetPayload.widgets ?? []).slice().sort((a, b) => a.order - b.order),
      );
    } catch (err) {
      setHero(null);
      setWidgets([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { hero, widgets, loading, error, refresh: () => void load() };
}

export default usePersonalizedDashboard;
