/** 引导接口里的注册来源：只在国内版、开关打开、首次完成引导时记一次，不写进偏好。 */
let session: { user: { id: string } } | null = { user: { id: 'u1' } };
const update = jest.fn(async (args: unknown) => args);
const updateMany = jest.fn(async () => ({ count: 1 }));
const findUnique = jest.fn(async () => ({ profileCompleted: false }));
const findFirst = jest.fn(async () => null);
const create = jest.fn(async (args: unknown) => args);
const createMany = jest.fn(async () => ({ count: 1 }));
const transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
    user: { update, updateMany, findUnique },
    usageLog: { create, findFirst },
}));

jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => session) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { update, updateMany, findUnique },
        usageLog: { create, findFirst },
        signupSourceEvent: { createMany },
        $transaction: transaction,
    },
}));

import { NextRequest } from 'next/server';
import { POST } from './route';
import { SIGNUP_SOURCE_FLAG } from '@/lib/growth/signup-source';

const saved = { app: process.env.APP_EDITION, pub: process.env.NEXT_PUBLIC_APP_EDITION, flag: process.env[SIGNUP_SOURCE_FLAG] };
function restore(key: string, value: string | undefined) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
}

function post(body: unknown) {
    return POST(new NextRequest('http://x/api/user/onboarding', { method: 'POST', body: JSON.stringify(body) }));
}

const body = { ageConfirmed: true, signupSource: 'xiaohongshu', preferences: { ageConfirmed: true, interest: 'solar' } };

describe('/api/user/onboarding 注册来源', () => {
    beforeEach(() => {
        for (const m of [update, updateMany, findUnique, findFirst, create, createMany]) m.mockClear();
        findUnique.mockImplementation(async () => ({ profileCompleted: false }));
        updateMany.mockImplementation(async () => ({ count: 1 }));
        session = { user: { id: 'u1' } };
        process.env.APP_EDITION = 'cn';
        process.env.NEXT_PUBLIC_APP_EDITION = 'cn';
        process.env[SIGNUP_SOURCE_FLAG] = 'true';
    });
    afterAll(() => {
        restore('APP_EDITION', saved.app);
        restore('NEXT_PUBLIC_APP_EDITION', saved.pub);
        restore(SIGNUP_SOURCE_FLAG, saved.flag);
    });

    it('首次完成引导：记一条，只有 userId 和代码；偏好里没有来源', async () => {
        const res = await post(body);
        expect(res.status).toBe(200);
        expect(createMany).toHaveBeenCalledWith({ data: [{ userId: 'u1', source: 'xiaohongshu' }], skipDuplicates: true });
        const logged = JSON.stringify(create.mock.calls);
        expect(logged).not.toContain('xiaohongshu');
        expect(logged).not.toContain('signupSource');
    });

    it('开关关闭（默认）：不记', async () => {
        delete process.env[SIGNUP_SOURCE_FLAG];
        expect((await post(body)).status).toBe(200);
        expect(createMany).not.toHaveBeenCalled();
    });

    it('已完成过引导：不再记', async () => {
        findUnique.mockImplementation(async () => ({ profileCompleted: true }));
        expect((await post(body)).status).toBe(200);
        expect(createMany).not.toHaveBeenCalled();
    });

    it('自由文本或不认识的代码：丢掉，引导照常完成', async () => {
        const res = await post({ ...body, signupSource: '在抖音刷到的' });
        expect(res.status).toBe(200);
        expect(createMany).not.toHaveBeenCalled();
    });

    it('没答（跳过）：不记，引导照常完成', async () => {
        const { signupSource: _skip, ...rest } = body;
        expect((await post(rest)).status).toBe(200);
        expect(createMany).not.toHaveBeenCalled();
    });

    it('写来源失败：引导照常完成', async () => {
        createMany.mockRejectedValueOnce(new Error('db down'));
        const res = await post(body);
        expect(res.status).toBe(200);
        expect((await res.json()).success).toBe(true);
    });

    it('国际版：即使打开开关也不记', async () => {
        process.env.APP_EDITION = 'global';
        process.env.NEXT_PUBLIC_APP_EDITION = 'global';
        expect((await post(body)).status).toBe(200);
        expect(createMany).not.toHaveBeenCalled();
    });
});
