/**
 * 光伏估算写在 calculation_snapshots。工作台计数和最近列表必须带上当前用户的快照，
 * 并且查询条件只能是会话里的 userId。
 */
const db = {
  calculationWhere: null as unknown,
  snapshotCountWhere: null as unknown,
  snapshotListWhere: null as unknown,
};

jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 'owner' } })) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(async () => ({
      name: '用户_112', plan: 'FREE', planExpireAt: null, lastResetAt: new Date(),
      dailyAiCalls: 0, dailyCalculations: 0, dailyPaperSearches: 0, dailyResourceQueries: 0,
    })) },
    project: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    calculation: { count: jest.fn(async ({ where }: { where: { userId?: string } }) => {
      db.calculationWhere = where;
      return where?.userId === 'owner' ? 0 : 50;
    }) },
    calculationSnapshot: {
      count: jest.fn(async ({ where }: { where: { userId?: string } }) => {
        db.snapshotCountWhere = where;
        return where?.userId === 'owner' ? 1 : 99;
      }),
      findMany: jest.fn(async ({ where }: { where: { userId?: string } }) => {
        db.snapshotListWhere = where;
        if (where?.userId !== 'owner') {
          return [{
            id: 'foreign', calcType: 'SOLAR_REVENUE', projectId: null, createdAt: new Date(),
            inputSnapshot: { location: { address: '别人的电站' }, capacity: 9, electricityPrice: 9.99 },
          }];
        }
        return [{
          id: 'snap-owner', calcType: 'SOLAR_REVENUE', projectId: null, createdAt: new Date('2026-11-12T11:00:00Z'),
          inputSnapshot: {
            location: { lat: 41.158, lng: 114.714, address: '河北张家口' },
            capacity: 100, unitCost: 3000, electricityPrice: 0.65123,
          },
        }];
      }),
    },
    savedPaper: { count: jest.fn(async () => 0) },
    station: { findMany: jest.fn(async () => []) },
    usageLog: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    policy: { findMany: jest.fn(async () => []) },
  },
}));

import { GET } from './route';

describe('工作台计入本人的测算快照', () => {
  it('测算次数含快照，最近列表出现已保存的光伏估算，且不读到其他用户', async () => {
    const body = await (await GET()).json();
    expect(db.calculationWhere).toEqual({ userId: 'owner' });
    expect(db.snapshotCountWhere).toEqual({ userId: 'owner' });
    expect(db.snapshotListWhere).toEqual({ userId: 'owner' });
    expect(body.data.counts).toMatchObject({ projects: 0, calculations: 1 });
    expect(body.data.recentProjects).toEqual([expect.objectContaining({
      id: 'snap-owner', name: '河北张家口', type: 'SOLAR', capacity: 100, href: '/audit/snap-owner',
    })]);
    const text = JSON.stringify(body);
    expect(text).not.toContain('别人的电站');
    expect(text).not.toContain('0.65123');
    expect(text).not.toContain('9.99');
    expect(text).not.toContain('"userId":"foreign"');
  });
});
