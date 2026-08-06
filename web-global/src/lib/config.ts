/**
 * Shared runtime configuration for the international (global) frontend.
 *
 * The app is a static export, so every backend call happens client-side.
 * When NEXT_PUBLIC_API_URL is not configured (or the service is
 * unreachable) pages must render an honest empty state — never fallback
 * data.
 */

declare const process: { env: { NEXT_PUBLIC_API_URL?: string } };

export const API_BASE = (
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
  ''
).replace(/\/$/, '');

/** GET a JSON resource; throws on any non-2xx response. */
export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Tolerantly extract a list of records from common API envelopes:
 *   [] | { data: [] } | { code: 0, data: [] } | { items: [] }
 *   | { data: { items: [] } } | { <key>: [] }
 * Returns null when the payload shape is unrecognized.
 */
export function extractList(payload: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;
  if (typeof body.code === 'number' && body.code !== 0) return null;

  const candidates: unknown[] = [body.items, body.results, body.data];
  for (const value of Object.values(body)) {
    if (Array.isArray(value)) candidates.push(value);
  }
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
    if (candidate && typeof candidate === 'object') {
      const inner = candidate as Record<string, unknown>;
      for (const key of ['items', 'results', 'reports', 'policies', 'alerts', 'data']) {
        if (Array.isArray(inner[key])) return inner[key] as Record<string, unknown>[];
      }
    }
  }
  return null;
}
