/**
 * /dashboard 可以在开发环境被预览开关打开放行，但数据接口没有会话就 401。
 * 页面只渲染这个接口返回的 data；失败时显示「工作台暂时无法加载」，不填任何用户记录。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const findUnique = jest.fn();
const projectFindMany = jest.fn();

jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => null) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique },
    project: { findMany: projectFindMany, count: jest.fn() },
    calculation: { count: jest.fn() },
    savedPaper: { count: jest.fn() },
    station: { findMany: jest.fn() },
    usageLog: { findFirst: jest.fn(), findMany: jest.fn() },
    policy: { findMany: jest.fn() },
  },
}));

import { GET } from './route';

describe('dashboard data requires the caller session', () => {
  const previousPreview = process.env.NEXT_PUBLIC_DEMO_PERSONA_PREVIEW;

  afterEach(() => {
    if (previousPreview === undefined) delete process.env.NEXT_PUBLIC_DEMO_PERSONA_PREVIEW;
    else process.env.NEXT_PUBLIC_DEMO_PERSONA_PREVIEW = previousPreview;
    findUnique.mockClear();
    projectFindMany.mockClear();
  });

  it('returns 401 and does not read a user when the demo preview flag is on', async () => {
    process.env.NEXT_PUBLIC_DEMO_PERSONA_PREVIEW = '1';
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: '请先登录' });
    expect(findUnique).not.toHaveBeenCalled();
    expect(projectFindMany).not.toHaveBeenCalled();
  });

  it('the page shows the load error instead of another person when the API refuses', () => {
    const page = readFileSync(join(__dirname, '../../(dashboard)/dashboard/page.tsx'), 'utf8');
    const rendered = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(page).toContain("fetch('/api/dashboard'");
    expect(page).toContain('只包含当前登录用户自己的项目');
    expect(rendered).toContain('工作台暂时无法加载');
    expect(rendered).not.toMatch(/陈欣|chen_xin/);
  });
});
