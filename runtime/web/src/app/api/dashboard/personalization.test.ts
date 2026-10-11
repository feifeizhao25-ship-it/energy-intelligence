/**
 * /api/dashboard 与 /api/user/preferences：免费用户也拿到个性化；只读已审核政策；偏好可保存与关闭。
 */
const db = {
    user: { plan: 'FREE', planExpireAt: null as Date | null },
    prefMeta: null as unknown,
    policyWhere: null as unknown,
    created: [] as any[],
};
jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 'u1' } })) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: jest.fn(async () => ({ name: '王建军', ...db.user, lastResetAt: new Date(), dailyAiCalls: 0, dailyCalculations: 0, dailyPaperSearches: 0, dailyResourceQueries: 0 })) },
        project: {
            findMany: jest.fn(async () => [{ id: 'p1', name: '张家口风光储基地（规划）', type: 'WIND', capacity: 50000, reportStatus: 'LOCKED', updatedAt: new Date(), location: '河北张家口' }]),
            count: jest.fn(async () => 1),
        },
        calculation: { count: jest.fn(async () => 0) },
        savedPaper: { count: jest.fn(async () => 0) },
        station: { findMany: jest.fn(async () => []) },
        usageLog: {
            findFirst: jest.fn(async () => (db.prefMeta ? { metadata: db.prefMeta } : null)),
            findMany: jest.fn(async () => []),
            create: jest.fn(async ({ data }: any) => { db.created.push(data); return data; }),
        },
        policy: { findMany: jest.fn(async ({ where }: any) => { db.policyWhere = where; return []; }) },
    },
}));

import { GET as dashboard } from './route';
import { GET as getPrefs, PUT as putPrefs } from '@/app/api/user/preferences/route';

describe('工作台个性化接口', () => {
    beforeEach(() => { db.prefMeta = null; db.created = []; });

    it('免费用户（政府角色、河北）：库里没有河北已审核政策时政策区降到最后，主卡看电价规则；只查 APPROVED 政策', async () => {
        db.prefMeta = { preferences: { role: 'government', province: '河北' } };
        const { data } = await (await dashboard()).json();
        expect(data.plan.code).toBe('FREE');
        expect(data.personalization.moduleOrder[0]).toBe('focus');
        expect(data.personalization.moduleOrder.at(-1)).toBe('policies');
        expect(data.personalization.tariff.status).toBe('market');
        expect(data.personalization.tariff.message).toContain('已取消固定分时');
        expect(db.policyWhere).toEqual({ reviewStatus: 'APPROVED' });
        // 项目所在地不会原样泄露到项目列表字段之外
        expect(data.recentProjects[0].location).toBeUndefined();
    });

    it('没设置过偏好：按项目所在地推断省份与关注领域，并提示去设置角色', async () => {
        const { data } = await (await dashboard()).json();
        expect(data.personalization.province).toBe('河北');
        expect(data.personalization.provinceSource).toBe('项目所在地');
        expect(data.personalization.interest).toBe('wind');
        expect(data.personalization.reasons.join()).toContain('还没有设置角色');
    });

    it('保存偏好：非法值 400；合法值写入 PROFILE_PREFERENCES，读取时生效', async () => {
        const bad = await putPrefs(new Request('http://x', { method: 'PUT', body: JSON.stringify({ role: 'boss' }) }));
        expect(bad.status).toBe(400);
        const ok = await putPrefs(new Request('http://x', { method: 'PUT', body: JSON.stringify({ role: 'engineer', province: '山东省', interest: 'solar', personalized: false }) }));
        expect(ok.status).toBe(200);
        expect(db.created[0]).toMatchObject({ userId: 'u1', type: 'PROFILE_PREFERENCES', metadata: { preferences: { role: 'engineer', province: '山东', personalized: false } } });
        db.prefMeta = db.created[0].metadata;
        expect((await (await getPrefs()).json()).preferences.personalized).toBe(false);
        const { data } = await (await dashboard()).json();
        expect(data.personalization.personalized).toBe(false);
    });
});
