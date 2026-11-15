/**
 * 环境变量打开的登录豁免在生产进程里必须失效。
 * 开发服务器和 Jest 的 test 环境保持原来的放行。
 */
jest.mock('next-intl/middleware', () => () => () => {
  const { NextResponse } = require('next/server');
  return NextResponse.next();
});
jest.mock('next-auth/middleware', () => ({
  withAuth: (middleware: unknown) => middleware,
}));

import { NextRequest } from 'next/server';
import proxy from './proxy';

const FLAGS = [
  { name: 'language scan', path: '/map', env: { NENGJIAN_LANGUAGE_SCAN: '1' } },
  { name: 'screenshot preview', path: '/datasets', env: { NENGJIAN_SCREENSHOT: '1' } },
  { name: 'demo dashboard preview', path: '/dashboard', env: { NEXT_PUBLIC_DEMO_PERSONA_PREVIEW: '1' } },
] as const;

function call(path: string) {
  return proxy(new NextRequest(new URL(path, 'http://127.0.0.1:3101')));
}

describe('production ignores env login bypasses', () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = previous.NODE_ENV;
    delete process.env.NENGJIAN_LANGUAGE_SCAN;
    delete process.env.NENGJIAN_SCREENSHOT;
    delete process.env.NEXT_PUBLIC_DEMO_PERSONA_PREVIEW;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_URL;
  });

  it.each(FLAGS)('production plus $name still redirects to login', async ({ path, env }) => {
    process.env.NODE_ENV = 'production';
    Object.assign(process.env, env);
    const response = await call(path);
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get('location')).toContain('/login');
    expect(response.headers.get('location')).toContain('callbackUrl');
  });

  it.each(['development', 'test'] as const)('%s keeps each bypass open', async (nodeEnv) => {
    process.env.NODE_ENV = nodeEnv;
    for (const { path, env } of FLAGS) {
      delete process.env.NENGJIAN_LANGUAGE_SCAN;
      delete process.env.NENGJIAN_SCREENSHOT;
      delete process.env.NEXT_PUBLIC_DEMO_PERSONA_PREVIEW;
      Object.assign(process.env, env);
      const response = await call(path);
      const location = response.headers.get('location') ?? '';
      expect(location.includes('/login') ? `${nodeEnv} ${path} -> ${location}` : location).not.toContain('/login');
    }
  });
});
