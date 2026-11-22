/**
 * @vitest-environment jsdom
 *
 * 11-22 UI check (mock replay of the 11-21 real answers): the analyst bubble
 * showed the model's Markdown literally ("**What a battery does**", "- ...").
 * Lives beside the App Router route, not under src/pages (Pages Router).
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/ai',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('../../lib/analytics', () => ({ trackEvent: vi.fn() }));

import AIAnalystPage from '../../pages/AIAnalystPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ANSWER = [
  'Bottom line: I cannot tell you whether it is worth it for you.',
  '',
  '**What a battery does (the simple version)**',
  '- A 6.6 kW solar system makes power only in daylight.',
  '- A battery stores surplus daytime solar.',
  '',
  '<img src=x onerror="alert(1)">',
].join('\n');

describe('AI analyst answer', () => {
  it('renders Markdown without literal marks and strips unsafe HTML', async () => {
    localStorage.setItem('auth_token', 'mock-token');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: ANSWER, sources: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));
    const { container } = render(<AIAnalystPage />);
    fireEvent.change(screen.getByPlaceholderText('Ask the AI analyst…'), {
      target: { value: 'Is a home battery worth it in Sydney?' },
    });
    fireEvent.submit(screen.getByPlaceholderText('Ask the AI analyst…').closest('form')!);
    const answer = await waitFor(() => {
      const el = container.querySelector('.analyst-answer');
      if (!el) throw new Error('no answer yet');
      return el;
    });
    expect(answer.textContent).toContain('What a battery does (the simple version)');
    expect(answer.textContent).not.toContain('**');
    expect(answer.querySelector('strong')?.textContent).toBe('What a battery does (the simple version)');
    expect(answer.querySelectorAll('li')).toHaveLength(2);
    expect(answer.querySelector('img')).toBeNull();
    expect(answer.innerHTML).not.toContain('onerror');
  });
});
