import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { userFromPayload } from './session-user';

const here = dirname(fileURLToPath(import.meta.url));

describe('signed-in name', () => {
  it('reads the user returned directly by /users/me', () => {
    const user = userFromPayload({ id: 'u1', name: 'Amina Diallo', email: 'amina@example.com', plan: 'free', created_at: '2026-01-01T00:00:00Z' });
    expect(user?.name).toBe('Amina Diallo');
    expect(user?.email).toBe('amina@example.com');
  });

  it('does not treat a token envelope as a person', () => {
    expect(userFromPayload({ data: { access_token: 'secret-token' } })).toBeNull();
  });

  it('the shell no longer hardcodes Analyst', () => {
    const source = readFileSync(join(here, '../../components/GlobalShell.tsx'), 'utf8');
    expect(source).not.toContain('userName="Analyst"');
    expect(source).toContain('user?.name');
  });
});
