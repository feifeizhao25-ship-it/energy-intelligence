let session: { user: { id: string } } | null = { user: { id: 'u1' } };
const update = jest.fn(async (args: unknown) => args);
const create = jest.fn(async (args: unknown) => args);
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
        user: { update },
        usageLog: { create },
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
        update.mockClear();
        create.mockClear();
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
        expect(update).toHaveBeenCalledTimes(2);
        const saved = update.mock.calls[0][0] as { where: { id: string }; data: { profileCompleted: boolean; ageConfirmedAt: Date } };
        expect(saved.where).toEqual({ id: 'u1' });
        expect(saved.data.profileCompleted).toBe(true);
        expect(saved.data.ageConfirmedAt).toBeInstanceOf(Date);
        expect(create).toHaveBeenCalledTimes(1);
        const log = create.mock.calls[0][0] as { data: { metadata: { points: number } } };
        expect(log.data.metadata.points).toBe(100);
        const points = update.mock.calls[1][0] as { data: { points: { increment: number } } };
        expect(points.data.points).toEqual({ increment: 100 });
    });

    it('preferences.ageConfirmed true is enough for the existing client payload', async () => {
        const res = await post({ preferences: { ageConfirmed: true }, completedAt: '2026-11-15T00:00:00.000Z' });
        expect(res.status).toBe(200);
        expect(update).toHaveBeenCalled();
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('database failure after confirmation awards no success reward', async () => {
        update.mockRejectedValueOnce(new Error('db down'));
        const res = await post({ ageConfirmed: true });
        expect(res.status).toBe(503);
        expect(create).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledTimes(1);
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
    });

    it('未登录 401，不写库', async () => {
        session = null;
        const res = await post({ ageConfirmed: true });
        expect(res.status).toBe(401);
        expect(update).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
    });
});
