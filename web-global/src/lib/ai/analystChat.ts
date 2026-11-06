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

export async function postAnalystChat(message: string, fetchImpl: typeof fetch = fetch): Promise<string> {
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
  const reply = replyFromAnalystPayload(await res.json());
  if (!reply) throw new Error('unrecognized payload');
  return reply;
}
