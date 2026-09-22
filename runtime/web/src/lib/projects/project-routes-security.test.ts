import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

jest.mock('@/lib/projects/owned', () => ({ ownedProject: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    assetAlert: { findMany: jest.fn(), updateMany: jest.fn() },
    maintenancePlan: { findMany: jest.fn() },
  },
}));
jest.mock('@/lib/timeline/service', () => ({ timelineService: { getTimeline: jest.fn(async () => []), recommendNextSteps: jest.fn(async () => []) } }));

import { ownedProject } from '@/lib/projects/owned';
import { prisma } from '@/lib/prisma';
import * as alerts from '@/app/api/projects/[id]/alerts/route';
import * as maintenance from '@/app/api/projects/[id]/maintenance/route';
import * as timeline from '@/app/api/v2/project/[id]/timeline/route';

const ROOT = join(__dirname, '..', '..', '..');
const ctx = (id = 'p1') => ({ params: Promise.resolve({ id }) });
const req = (url = 'http://x/api', init?: RequestInit) => new NextRequest(url, init as never);

beforeEach(() => jest.clearAllMocks());

describe('项目运维接口只对所有者开放，数据来自数据库', () => {
  it('未登录 401，别人的项目 404（原来任何人都能读写）', async () => {
    jest.mocked(ownedProject).mockResolvedValueOnce('unauthenticated');
    expect((await alerts.GET(req(), ctx())).status).toBe(401);
    jest.mocked(ownedProject).mockResolvedValueOnce(null);
    expect((await maintenance.GET(req(), ctx())).status).toBe(404);
    jest.mocked(ownedProject).mockResolvedValueOnce(null);
    expect((await timeline.GET(req(), ctx())).status).toBe(404);
    expect(prisma.assetAlert.findMany).not.toHaveBeenCalled();
  });

  it('告警读自 asset_alerts，不再有预置的演示告警', async () => {
    jest.mocked(ownedProject).mockResolvedValue({ id: 'p1', userId: 'u1' });
    jest.mocked(prisma.assetAlert.findMany).mockResolvedValue([
      { id: 'a1', severity: 'HIGH', status: 'ACTIVE', title: 'PR 偏低', description: 'd', recommendation: null, createdAt: new Date(), resolvedAt: null },
    ] as never);
    const body = await (await alerts.GET(req(), ctx())).json();
    expect(body.data.summary).toEqual({ total: 1, active: 1, errors: 1, warnings: 0 });
    expect(JSON.stringify(body)).not.toMatch(/逆变器 #03/);
    const src = readFileSync(join(ROOT, 'src/app/api/projects/[id]/alerts/route.ts'), 'utf8');
    expect(src).not.toMatch(/new Map\(/);
  });

  it('浏览器不能伪造告警；只能改自己项目的告警状态', async () => {
    expect((await alerts.POST()).status).toBe(405);
    jest.mocked(ownedProject).mockResolvedValue({ id: 'p1', userId: 'u1' });
    jest.mocked(prisma.assetAlert.updateMany).mockResolvedValue({ count: 0 } as never);
    const res = await alerts.PATCH(req('http://x', { method: 'PATCH', body: JSON.stringify({ alertId: 'other', status: 'resolved' }) }), ctx());
    expect(res.status).toBe(404);
    expect(jest.mocked(prisma.assetAlert.updateMany).mock.calls[0][0]).toMatchObject({ where: { id: 'other', projectId: 'p1' } });
  });

  it('维护计划只读；手动建单如实返回未开放', async () => {
    expect((await maintenance.POST()).status).toBe(501);
    expect((await maintenance.PATCH()).status).toBe(501);
  });

  it('测试端点与内存版配置接口已移除；定时任务在生产环境不接受默认口令', () => {
    for (const f of ['src/app/api/test-all/route.ts', 'src/app/api/test-maintenance/route.ts', 'src/app/api/projects/[id]/config/route.ts']) {
      expect([f, existsSync(join(ROOT, f))]).toEqual([f, false]);
    }
    const cron = readFileSync(join(ROOT, 'src/app/api/cron/policies/route.ts'), 'utf8');
    expect(cron).toMatch(/NODE_ENV === 'production' \? '' : 'dev-secret-key'/);
    const maint = readFileSync(join(ROOT, 'src/app/api/maintenance/route.ts'), 'utf8');
    expect(maint).toMatch(/getServerSession\(authOptions\)/);
  });
});
