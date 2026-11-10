const count = jest.fn(async () => 0);
const findUnique = jest.fn();

jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => null) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    policy: { count },
    user: { findUnique },
  },
}));

import { GET } from './route';

describe('screenshot preview cannot skip login in production', () => {
  const previousNode = process.env.NODE_ENV;
  const previousShot = process.env.NENGJIAN_SCREENSHOT;

  afterEach(() => {
    process.env.NODE_ENV = previousNode;
    if (previousShot === undefined) delete process.env.NENGJIAN_SCREENSHOT;
    else process.env.NENGJIAN_SCREENSHOT = previousShot;
    count.mockClear();
  });

  it('production plus the screenshot flag still requires a session', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NENGJIAN_SCREENSHOT = '1';
    const response = await GET();
    expect(response.status).toBe(401);
    expect(count).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('a non-production screenshot still returns the preview, not a user record', async () => {
    process.env.NODE_ENV = 'test';
    process.env.NENGJIAN_SCREENSHOT = '1';
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.preview).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/userId|email/);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
