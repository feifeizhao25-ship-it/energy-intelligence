/**
 * Client-side product analytics for EnergyIQ Global.
 *
 * Contract (backend: app/api/v1/analytics.py):
 * - POST /api/v1/analytics/events, requires an authenticated session (Bearer).
 * - event_id: client-generated UUIDv4 — backend dedupes on it (idempotent retries safe).
 * - occurred_at: ISO-8601 with timezone.
 * - Whitelisted client events only; financial lifecycle events
 *   (checkout_started / payment_succeeded / …) are server-webhook-only and MUST
 *   never be emitted here.
 *
 * Behaviour: fail-open. Analytics must never break UX — every error is
 * swallowed after a console.debug. Anonymous visitors are skipped silently
 * (the ingest endpoint is authenticated by design).
 */

import { fetchApi, getAuthToken } from './api';

export type ClientEventName =
  | 'landing_viewed'
  | 'dataset_previewed'
  | 'workspace_created'
  | 'analysis_completed'
  | 'report_exported'
  | 'trial_started'
  | 'enterprise_lead_qualified';

function uuidV4(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Capture attribution params once per call site (cheap; querystring is tiny). */
function readAttribution(): {
  channel?: string;
  campaign?: string;
  experiment?: string;
} {
  if (typeof window === 'undefined') return {};
  const q = new URLSearchParams(window.location.search);
  const clip = (v: string | null, max: number): string | undefined =>
    v ? v.slice(0, max) : undefined;
  return {
    channel: clip(q.get('utm_source'), 64),
    campaign: clip(q.get('utm_campaign'), 128),
    experiment: clip(q.get('utm_experiment') || q.get('xp'), 128),
  };
}

export async function trackEvent(
  eventName: ClientEventName,
  properties: Record<string, unknown> = {},
): Promise<void> {
  if (typeof window === 'undefined') return; // SSR / build-time guard
  if (!getAuthToken()) return; // endpoint is authenticated; skip anonymous
  try {
    await fetchApi('/api/v1/analytics/events', {
      method: 'POST',
      body: JSON.stringify({
        event_id: uuidV4(),
        event_name: eventName,
        locale: (navigator.language || 'en').slice(0, 20),
        occurred_at: new Date().toISOString(),
        properties,
        ...readAttribution(),
      }),
    });
  } catch (err) {
    // Fail-open: analytics must never surface as a user-facing error.
    console.debug('[analytics] event dropped:', eventName, err);
  }
}

let landingFiredThisLoad = false;

/**
 * Fire `landing_viewed` once per page load (module guard also survives
 * React StrictMode double-invoked effects in dev).
 */
export function trackLandingViewed(): void {
  if (landingFiredThisLoad) return;
  landingFiredThisLoad = true;
  const properties: Record<string, unknown> = {
    path: window.location.pathname,
  };
  // Referrer hostname only — full URLs can carry third-party querystrings.
  if (document.referrer) {
    try {
      properties.referrer_host = new URL(document.referrer).hostname;
    } catch {
      /* malformed referrer — omit */
    }
  }
  void trackEvent('landing_viewed', properties);
}
