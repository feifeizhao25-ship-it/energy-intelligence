/** Shared gate for suites that must use only the disposable local database. */

export const INTEGRATION_SKIP_MESSAGE = 'skipped: INTEGRATION_DATABASE_URL is unset';

const DUMMY_URL = 'postgresql://unused:unused@127.0.0.1:5432/energy_integration_test';

export function disposableIntegration(): string | null {
  const url = process.env.INTEGRATION_DATABASE_URL;
  if (!url) return null;
  const parsed = new URL(url);
  if (parsed.hostname !== '127.0.0.1' || parsed.pathname !== '/energy_integration_test') {
    throw new Error('Requires isolated local database');
  }
  return url;
}

export function prismaUrl(): string {
  return disposableIntegration() || DUMMY_URL;
}

export const integrationSuite = disposableIntegration()
  ? describe
  : (name: string, fn: () => void) => describe.skip(`${name} — ${INTEGRATION_SKIP_MESSAGE}`, fn);
