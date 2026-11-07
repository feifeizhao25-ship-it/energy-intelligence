/**
 * International AI analyst chat.
 *
 * POST /api/v1/ai/chat takes `message` as a query parameter, requires a login
 * bearer token, and answers with a text/event-stream body. A JSON body sent
 * there is not the question, and a missing Authorization header is
 * 401 "Not authenticated".
 *
 * POST /api/v1/ai/chat-json takes `{ message }` plus the same bearer token and
 * returns a JSON object whose reply is `message` (not an event stream).
 */

import { API_BASE } from '../config';
import { readStoredAuthToken } from '../api';

export const ANALYST_CHAT_PATH = '/api/v1/ai/chat-json';

export interface AnalystSource {
  title: string;
  url?: string | null;
  publisher?: string | null;
  published_at?: string | null;
  locator?: string | null;
  excerpt?: string | null;
  freshness_status?: string | null;
  evidence_status?: string | null;
  status?: string | null;
  license?: string | null;
}

export interface AnalystReply {
  text: string;
  sources: AnalystSource[];
  answerId: string | null;
  downloads: { pdf: boolean; docx: boolean };
  standIn: boolean;
  synthetic: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function textField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function sourcesFromAnalystPayload(payload: unknown): AnalystSource[] {
  const body = asRecord(payload);
  if (!body) return [];
  const evidence = asRecord(body.evidence);
  const raw = body.sources ?? evidence?.sources;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const row = asRecord(item);
    const title = textField(row?.title);
    if (!row || !title) return [];
    return [{
      title,
      url: textField(row.url) ?? textField(row.source_url),
      publisher: textField(row.publisher) ?? textField(row.source_org),
      published_at: textField(row.published_at),
      locator: textField(row.locator),
      excerpt: textField(row.excerpt),
      freshness_status: textField(row.freshness_status),
      evidence_status: textField(row.evidence_status),
      status: textField(row.status),
      license: textField(row.license) ?? textField(row.license_note),
    }];
  });
}

export function citationLine(source: AnalystSource, index: number): string {
  const bits = [`[${index}] ${source.title}`];
  if (source.publisher) bits.push(source.publisher);
  if (source.published_at) bits.push(source.published_at);
  if (source.url) bits.push(source.url);
  if (source.locator) bits.push(`Locator: ${source.locator}`);
  if (source.excerpt) bits.push(`Excerpt: ${source.excerpt}`);
  if (source.freshness_status) bits.push(`Freshness: ${source.freshness_status}`);
  if (source.evidence_status === 'auto_extracted') {
    bits.push('Review: machine extract, not a human-reviewed publication.');
  } else if (source.evidence_status === 'legacy_unreviewed') {
    bits.push('Review status: not recorded as a human review.');
  } else if (source.evidence_status === 'pending' || source.status === '待核实' || source.status === '待审核') {
    bits.push('Not published: pending review.');
  }
  if (source.license) bits.push(`License: ${source.license}`);
  return bits.join(' | ');
}

export function clipboardAnswer(text: string, sources: AnalystSource[]): string {
  const lines = sources.map((source, index) => citationLine(source, index + 1));
  return lines.length ? `${text}\n\nSources\n${lines.join('\n')}` : text;
}

export function replyFromAnalystPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;
  if (typeof body.code === 'number' && body.code !== 0) return null;
  const sources: unknown[] = [body, body.data];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const message = (source as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return null;
}

export function analystReplyFromPayload(payload: unknown): AnalystReply | null {
  const text = replyFromAnalystPayload(payload);
  if (!text) return null;
  const body = asRecord(payload) ?? {};
  const meta = asRecord(body.ai_metadata);
  const downloads = asRecord(body.downloads);
  return {
    text,
    sources: sourcesFromAnalystPayload(payload),
    answerId: textField(body.answer_id),
    downloads: {
      pdf: downloads?.pdf === true,
      docx: downloads?.docx === true,
    },
    standIn: meta?.model_called === false || typeof meta?.stand_in === 'string',
    synthetic: body.synthetic === true,
  };
}

export async function postAnalystChat(message: string, fetchImpl: typeof fetch = fetch): Promise<AnalystReply> {
  const question = message.trim();
  if (!question) throw new Error('empty message');
  const token = readStoredAuthToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetchImpl(`${API_BASE}${ANALYST_CHAT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: question }),
  });
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/event-stream')) {
    throw new Error('unexpected event stream from AI analyst');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reply = analystReplyFromPayload(await res.json());
  if (!reply) throw new Error('unrecognized payload');
  return reply;
}

export async function downloadAnalystAnswer(
  answerId: string,
  format: 'pdf' | 'docx',
  fetchImpl: typeof fetch = fetch,
): Promise<Blob> {
  const token = readStoredAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetchImpl(`${API_BASE}/api/v1/ai/answers/${answerId}/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ format }),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      const nested = body && typeof body === 'object' ? (body as { detail?: unknown; message?: unknown }).detail : undefined;
      const message = typeof nested === 'string'
        ? nested
        : nested && typeof nested === 'object' && typeof (nested as { message?: unknown }).message === 'string'
          ? (nested as { message: string }).message
          : typeof (body as { message?: unknown })?.message === 'string'
            ? (body as { message: string }).message
            : '';
      if (message.trim()) detail = message.trim();
    } catch {
      // The status is enough when the body is not JSON.
    }
    throw new Error(detail);
  }
  return res.blob();
}
