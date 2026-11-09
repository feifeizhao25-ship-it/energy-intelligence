/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ANALYST_CHAT_PATH, postAnalystChat, replyFromAnalystPayload } from './analystChat';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = 'auth_token=; Max-Age=0';
  document.cookie = 'token=; Max-Age=0';
  vi.unstubAllGlobals();
});

describe('international analyst chat contract', () => {
  it('posts JSON to chat-json with the stored bearer token and reads message', async () => {
    localStorage.setItem('auth_token', 'tok-1');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      message: 'Payback is driven by installed cost and the retail tariff.',
      evidence: { sources: [] },
      structured: { headline: 'Payback is driven by installed cost and the retail tariff.' },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const reply = await postAnalystChat('  What drives rooftop solar payback?  ');

    expect(reply).toBe('Payback is driven by installed cost and the retail tariff.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ANALYST_CHAT_PATH);
    expect(url).not.toBe('/api/v1/ai/chat');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-1');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ message: 'What drives rooftop solar payback?' });
  });

  it('accepts a session or cookie token the same way the rest of the app does', async () => {
    sessionStorage.setItem('token', 'sess-tok');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: 'ok' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await postAnalystChat('hi');
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sess-tok');
  });

  it('does not call the network when no login token is stored', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(postAnalystChat('hi')).rejects.toThrow(/Not authenticated/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects the streaming chat content type instead of rendering a chunk', async () => {
    localStorage.setItem('auth_token', 'tok-1');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('data: {"content":"partial"}\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })));
    await expect(postAnalystChat('hi')).rejects.toThrow(/event stream/);
  });

  it('reads only the JSON message field, not a streaming content chunk', () => {
    expect(replyFromAnalystPayload({ message: 'full answer', content: 'ignored' })).toBe('full answer');
    expect(replyFromAnalystPayload({ data: { message: 'wrapped' } })).toBe('wrapped');
    expect(replyFromAnalystPayload({ content: 'partial chunk' })).toBeNull();
    expect(replyFromAnalystPayload('data: {"content":"x"}')).toBeNull();
    expect(replyFromAnalystPayload({ code: 500, message: 'nope' })).toBeNull();
  });
});
