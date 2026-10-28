/**
 * 政策审核后台：只有 POLICY_REVIEWERS 指定的用户能看列表、通过/驳回；审核人与时间由服务端记录，不接受客户端自报。
 */
let sessionUser: { id: string } | null = { id: 'u-reviewer' };
const users: Record<string, { id: string; name: string | null; phone: string | null }> = {
    'u-reviewer': { id: 'u-reviewer', name: '审核甲', phone: '13900000001' },
    'u-phone': { id: 'u-phone', name: null, phone: '13900000002' },
    'u-normal': { id: 'u-normal', name: '普通用户', phone: '13900000003' },
};
const updates: any[] = [];
jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => (sessionUser ? { user: sessionUser } : null)) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: jest.fn(async ({ where }: any) => users[where.id] ?? null) },
        policy: {
            findMany: jest.fn(async ({ where }: any) => [{ id: 'p1', region: '江苏', reviewStatus: where.reviewStatus }]),
            groupBy: jest.fn(async () => [{ reviewStatus: 'PENDING', _count: { _all: 3 } }]),
            update: jest.fn(async ({ where, data }: any) => {
                if (where.id === 'missing') throw new Error('not found');
                updates.push({ where, data });
                return { id: where.id, sourceTitle: '江苏补贴', ...data };
            }),
        },
    },
}));

import { NextRequest } from 'next/server';
import { GET } from './route';
import { POST as review } from './[id]/review/route';
import { isPolicyReviewer, reviewerAllowlist } from '@/lib/admin/policy-reviewers';

const list = (status = 'PENDING') => GET(new NextRequest(`http://x/api/admin/policies?status=${status}`));
const decide = (id: string, body: object) => review(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeEach(() => { process.env.POLICY_REVIEWERS = 'u-reviewer, 13900000002'; updates.length = 0; sessionUser = { id: 'u-reviewer' }; });
afterAll(() => { delete process.env.POLICY_REVIEWERS; });

describe('审核员名单', () => {
    it('按用户 ID 或手机号匹配；未配置时没有任何审核员', () => {
        expect(isPolicyReviewer(users['u-reviewer'])).toBe(true);
        expect(isPolicyReviewer(users['u-phone'])).toBe(true);
        expect(isPolicyReviewer(users['u-normal'])).toBe(false);
        expect(reviewerAllowlist({}).size).toBe(0);
        expect(isPolicyReviewer(users['u-reviewer'], {})).toBe(false);
    });
});

describe('政策审核接口', () => {
    it('未登录 401；普通用户看列表得到空回落，审核操作仍拒绝', async () => {
        sessionUser = null;
        expect((await list()).status).toBe(401);
        sessionUser = { id: 'u-normal' };
        const fallback = await list();
        expect(fallback.status).toBe(200);
        const body = await fallback.json();
        expect(body.roleFallback).toBe(true);
        expect(body.items).toEqual([]);
        expect((await decide('p1', { decision: 'APPROVED' })).status).toBe(404);
        expect(updates).toHaveLength(0);
    });

    it('审核员可按状态查看列表与各状态数量', async () => {
        const body = await (await list('REJECTED')).json();
        expect(body.status).toBe('REJECTED');
        expect(body.items[0].reviewStatus).toBe('REJECTED');
        expect(body.counts.PENDING).toBe(3);
    });

    it('通过：审核人取当前登录的审核员（姓名 + 用户 ID），客户端传的审核人被忽略，时间由服务端记录', async () => {
        const res = await decide('p1', { decision: 'APPROVED', reviewer: '冒充的人' });
        expect(res.status).toBe(200);
        expect(updates[0].data).toMatchObject({ reviewStatus: 'APPROVED', reviewer: '审核甲（用户 u-reviewer）' });
        expect(updates[0].data.reviewedAt).toBeInstanceOf(Date);
        sessionUser = { id: 'u-phone' };
        await decide('p1', { decision: 'REJECTED' });
        expect(updates[1].data).toMatchObject({ reviewStatus: 'REJECTED', reviewer: '用户 u-phone' });
        expect(JSON.stringify(updates)).not.toContain('13900000002'); // 不把手机号写进政策表
    });

    it('无效决定 400；不存在的政策 404', async () => {
        expect((await decide('p1', { decision: 'MAYBE' })).status).toBe(400);
        expect((await decide('missing', { decision: 'APPROVED' })).status).toBe(404);
    });
});
