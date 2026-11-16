let session: { user: { id: string } } | null = { user: { id: 'u1' } };
const update = jest.fn(async (args: unknown) => args);
const updateMany = jest.fn(async () => ({ count: 1 }));
const findUnique = jest.fn(async () => ({ profileCompleted: false }));
const findFirst = jest.fn(async () => null);
const create = jest.fn(async (args: unknown) => args);
const transaction = jest.fn(async (fn: (tx: {
    user: { update: typeof update; updateMany: typeof updateMany; findUnique: typeof findUnique };
    usageLog: { create: typeof create; findFirst: typeof findFirst };
}) => Promise<unknown>) => fn({
    user: { update, updateMany, findUnique },
    usageLog: { create, findFirst },
}));
const previousEdition = {
    app: process.env.APP_EDITION,
    pub: process.env.NEXT_PUBLIC_APP_EDITION,
};

function setEdition(value: string) {
    process.env.APP_EDITION = value;
    process.env.NEXT_PUBLIC_APP_EDITION = value;
}

function restoreEdition() {
    if (previousEdition.app === undefined) delete process.env.APP_EDITION;
    else process.env.APP_EDITION = previousEdition.app;
    if (previousEdition.pub === undefined) delete process.env.NEXT_PUBLIC_APP_EDITION;
    else process.env.NEXT_PUBLIC_APP_EDITION = previousEdition.pub;
}

jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => session) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { update, updateMany, findUnique },
        usageLog: { create, findFirst },
        $transaction: transaction,
    },
}));

import { NextRequest } from 'next/server';
import { POST } from './route';

function post(body: unknown) {
    return POST(new NextRequest('http://x/api/user/onboarding', {
        method: 'POST',
        body: JSON.stringify(body),
    }));
}

describe('/api/user/onboarding age confirmation', () => {
    beforeEach(() => {
        update.mockReset();
        update.mockImplementation(async (args: unknown) => args);
        updateMany.mockReset();
        updateMany.mockImplementation(async () => ({ count: 1 }));
        findUnique.mockReset();
        findUnique.mockImplementation(async () => ({ profileCompleted: false }));
        findFirst.mockReset();
        findFirst.mockImplementation(async () => null);
        create.mockReset();
        create.mockImplementation(async (args: unknown) => args);
        transaction.mockClear();
        session = { user: { id: 'u1' } };
        setEdition('cn');
    });

    afterEach(() => {
        restoreEdition();
    });

    it('ageConfirmed false returns 400 and awards no points', async () => {
        const res = await post({ ageConfirmed: false, preferences: { ageConfirmed: false } });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: '请先确认已年满 16 周岁' });
        expect(update).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
    });

    it.each([
        [{ preferences: { ageConfirmed: false } }],
        [{ ageConfirmed: true, preferences: { ageConfirmed: false } }],
        [{ ageConfirmed: 'true' }],
        [{}],
        [{ ageConfirmed: 1 }],
    ])('rejects %# without writing points', async (body) => {
        const res = await post(body);
        expect(res.status).toBe(400);
        expect(update).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
    });

    it('ageConfirmed true persists the confirmation and awards 100 points once', async () => {
        const res = await post({
            ageConfirmed: true,
            preferences: { interest: 'solar', ageConfirmed: true },
            completedAt: '2026-11-15T00:00:00.000Z',
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ success: true, rewards: { points: 100 } });
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(updateMany).toHaveBeenCalledTimes(1);
        const saved = updateMany.mock.calls[0][0] as { where: { id: string; profileCompleted: boolean }; data: { profileCompleted: boolean; ageConfirmedAt: Date } };
        expect(saved.where).toEqual({ id: 'u1', profileCompleted: false });
        expect(saved.data.profileCompleted).toBe(true);
        expect(saved.data.ageConfirmedAt).toBeInstanceOf(Date);
        expect(create).toHaveBeenCalledTimes(1);
        const log = create.mock.calls[0][0] as { data: { metadata: { points: number } } };
        expect(log.data.metadata.points).toBe(100);
        expect(update).toHaveBeenCalledTimes(1);
        const points = update.mock.calls[0][0] as { data: { points: { increment: number } } };
        expect(points.data.points).toEqual({ increment: 100 });
    });

    it('preferences.ageConfirmed true is enough for the existing client payload', async () => {
        const res = await post({ preferences: { ageConfirmed: true }, completedAt: '2026-11-15T00:00:00.000Z' });
        expect(res.status).toBe(200);
        expect(update).toHaveBeenCalled();
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('database failure after confirmation awards no success reward', async () => {
        updateMany.mockRejectedValueOnce(new Error('db down'));
        const res = await post({ ageConfirmed: true });
        expect(res.status).toBe(503);
        expect(create).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('profileCompleted already true returns 200 without points or another log', async () => {
        findUnique.mockResolvedValue({ profileCompleted: true });
        const res = await post({ ageConfirmed: true, preferences: { ageConfirmed: true } });
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ success: true, rewards: { points: 0 } });
        expect(updateMany).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
    });

    it('an existing ONBOARDING_COMPLETE log returns 200 without points or another log', async () => {
        findFirst.mockResolvedValue({ id: 'log-1' });
        const res = await post({ ageConfirmed: true });
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ success: true, rewards: { points: 0 } });
        expect(findFirst).toHaveBeenCalledWith({
            where: { userId: 'u1', type: 'ONBOARDING_COMPLETE' },
            select: { id: true },
        });
        expect(updateMany).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
    });

    it('three claims pay 100 points only on the first', async () => {
        let profileCompleted = false;
        let logs = 0;
        findUnique.mockImplementation(async () => ({ profileCompleted }));
        findFirst.mockImplementation(async () => (logs > 0 ? { id: 'log-1' } : null));
        updateMany.mockImplementation(async () => {
            if (profileCompleted) return { count: 0 };
            profileCompleted = true;
            return { count: 1 };
        });
        create.mockImplementation(async (args: unknown) => {
            logs += 1;
            return args;
        });

        const points: number[] = [];
        for (let i = 0; i < 3; i += 1) {
            const res = await post({ ageConfirmed: true, preferences: { ageConfirmed: true } });
            expect(res.status).toBe(200);
            const body = await res.json() as { rewards: { points: number } };
            points.push(body.rewards.points);
        }
        expect(points).toEqual([100, 0, 0]);
        expect(create).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledTimes(1);
        expect(update.mock.calls[0][0]).toMatchObject({ data: { points: { increment: 100 } } });
    });

    it('concurrent claims cannot both pay', async () => {
        let profileCompleted = false;
        let logs = 0;
        let readers = 0;
        let releaseReaders: () => void = () => {};
        const bothReading = new Promise<void>((resolve) => {
            releaseReaders = resolve;
        });
        findUnique.mockImplementation(async () => {
            readers += 1;
            if (readers >= 2) releaseReaders();
            await bothReading;
            return { profileCompleted };
        });
        findFirst.mockImplementation(async () => (logs > 0 ? { id: 'log-1' } : null));
        updateMany.mockImplementation(async () => {
            if (profileCompleted) return { count: 0 };
            profileCompleted = true;
            return { count: 1 };
        });
        create.mockImplementation(async (args: unknown) => {
            logs += 1;
            return args;
        });

        const responses = await Promise.all([
            post({ ageConfirmed: true }),
            post({ ageConfirmed: true }),
        ]);
        expect(responses.map((res) => res.status)).toEqual([200, 200]);
        const bodies = await Promise.all(responses.map((res) => res.json() as Promise<{ rewards: { points: number } }>));
        expect(bodies.map((body) => body.rewards.points).sort()).toEqual([0, 100]);
        expect(create).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledTimes(1);
        expect(updateMany.mock.calls.length).toBeGreaterThan(0);
    });

    it('a lost conditional update pays nothing', async () => {
        updateMany.mockResolvedValue({ count: 0 });
        const res = await post({ ageConfirmed: true });
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ success: true, rewards: { points: 0 } });
        expect(create).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('intl keeps the previous onboarding API when ageConfirmed is false', async () => {
        setEdition('intl');
        const res = await post({ ageConfirmed: false, preferences: { ageConfirmed: false } });
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({
            success: true,
            rewards: { points: 100, aiCalls: 10, calculations: 5 },
        });
        expect(update).toHaveBeenCalledTimes(2);
        const saved = update.mock.calls[0][0] as { data: Record<string, unknown> };
        expect(saved.data).toEqual({ profileCompleted: true });
        expect(saved.data).not.toHaveProperty('ageConfirmedAt');
        const log = create.mock.calls[0][0] as { data: { metadata: { points: number } } };
        expect(log.data.metadata.points).toBe(100);
        const points = update.mock.calls[1][0] as { data: { points: { increment: number } } };
        expect(points.data.points).toEqual({ increment: 100 });
        expect(transaction).not.toHaveBeenCalled();
        expect(updateMany).not.toHaveBeenCalled();
    });

    it('未登录 401，不写库', async () => {
        session = null;
        const res = await post({ ageConfirmed: true });
        expect(res.status).toBe(401);
        expect(update).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
    });
});
