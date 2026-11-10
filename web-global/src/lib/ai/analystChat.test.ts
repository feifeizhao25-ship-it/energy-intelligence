/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ANALYST_CHAT_PATH, clipboardAnswer, downloadAnalystAnswer, postAnalystChat, replyFromAnalystPayload, sourcesFromAnalystPayload } from './analystChat';

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

    expect(reply.text).toBe('Payback is driven by installed cost and the retail tariff.');
    expect(reply.sources).toEqual([]);
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

  it('keeps structured sources for display and copies them with the answer', () => {
    const payload = {
      message: 'Notice 2025-42 is the library record [S1].',
      sources: [{
        title: 'IRS Notice 2025-42',
        url: 'https://www.irs.gov/pub/irs-drop/n-25-42.pdf',
        publisher: 'Internal Revenue Service',
        published_at: '2025-08-15',
        date_kind: 'pdf_creation',
        effective_date: '2025-09-02',
        effective_date_stated: true,
        effective_date_basis: 'Notice 2025-42 section 7.',
        locator: 'Notice 2025-42 sections 1, 2.02, 3, 6, and 7',
        excerpt: 'The notice describes the credit deadline.',
        freshness_status: 'current',
        evidence_status: 'legacy_unreviewed',
      }],
      answer_id: 'ans-1',
      downloads: { pdf: true, docx: false },
      synthetic: false,
      ai_metadata: { stand_in: 'library_only', model_called: false },
    };
    const sources = sourcesFromAnalystPayload(payload);
    expect(sources[0].locator).toBe('Notice 2025-42 sections 1, 2.02, 3, 6, and 7');
    expect(sources[0].url).toContain('irs.gov');
    const copied = clipboardAnswer(payload.message, sources);
    expect(copied).toContain(payload.message);
    expect(copied).toContain('PDF file metadata date (CreationDate): 2025-08-15');
    expect(copied).toContain('Printed publication date: unknown');
    expect(copied).toContain('Effective date: 2025-09-02');
    expect(copied).not.toContain('Published');
    expect(copied).toContain('https://www.irs.gov/pub/irs-drop/n-25-42.pdf');
    expect(copied).toContain('Locator: Notice 2025-42 sections 1, 2.02, 3, 6, and 7');
    expect(copied).toContain('not recorded as a human review');
    expect(copied).not.toContain('example.gov');
  });

  it('reads only the JSON message field, not a streaming content chunk', () => {
    expect(replyFromAnalystPayload({ message: 'full answer', content: 'ignored' })).toBe('full answer');
    expect(replyFromAnalystPayload({ data: { message: 'wrapped' } })).toBe('wrapped');
    expect(replyFromAnalystPayload({ content: 'partial chunk' })).toBeNull();
    expect(replyFromAnalystPayload('data: {"content":"x"}')).toBeNull();
    expect(replyFromAnalystPayload({ code: 500, message: 'nope' })).toBeNull();
  });

  it('shows the export endpoint message for a refused download', async () => {
    localStorage.setItem('auth_token', 'tok-1');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      detail: { error: 'REPORT_QUOTA_EXCEEDED', message: "You have used this month's report exports (3). This is not an extra AI answer." },
    }), { status: 429 })));
    await expect(downloadAnalystAnswer('ans-1', 'pdf')).rejects.toThrow(/report exports \(3\)/);
  });
});
