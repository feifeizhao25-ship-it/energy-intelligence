jest.mock('@/lib/prisma', () => ({
    prisma: {
        subscription: { findMany: jest.fn(), updateMany: jest.fn() },
        $transaction: jest.fn(),
    },
}));

import { prisma } from '@/lib/prisma';
import { POST } from './route';

const findMany = prisma.subscription.findMany as jest.Mock;
const updateMany = prisma.subscription.updateMany as jest.Mock;
const end = new Date('2020-01-01T00:00:00.000Z');

function post(secret = 'cron-secret') {
    return POST(new Request('http://x/api/cron/membership', {
        method: 'POST',
        headers: secret ? { authorization: `Bearer ${secret}` } : {},
    }));
}

beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret';
    process.env.NODE_ENV = 'test';
    findMany.mockReset();
    updateMany.mockReset();
    (prisma.$transaction as jest.Mock).mockReset();
});

test('没有调度密钥不能触发到期切换', async () => {
    expect((await post('wrong')).status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
});

test('到期且周期未变时改续费档位，不改到期日', async () => {
    findMany.mockResolvedValue([{
        id: 'sub1', userId: 'u1', plan: 'FULL', endDate: end,
        scheduledPlan: 'PRO', scheduledFromPlan: 'FULL', scheduledEffectiveAt: end,
        user: { id: 'u1', plan: 'FULL' },
    }]);
    const userUpdate = jest.fn(async () => ({ count: 1 }));
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<boolean>) => fn({
        subscription: { updateMany: jest.fn(async () => ({ count: 1 })) },
        user: { updateMany: userUpdate },
    }));
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ applied: 1, cancelled: 0 });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'u1', plan: 'FULL' }, data: { plan: 'PRO' } });
    const payload = JSON.stringify(userUpdate.mock.calls);
    expect(payload).not.toContain('planExpireAt');
    expect(payload).not.toContain('endDate');
});

test('续费改过到期日的申请被取消，不切换档位', async () => {
    findMany.mockResolvedValue([{
        id: 'sub1', userId: 'u1', plan: 'FULL', endDate: new Date('2025-12-01T00:00:00.000Z'),
        scheduledPlan: 'PRO', scheduledFromPlan: 'FULL', scheduledEffectiveAt: end,
        user: { id: 'u1', plan: 'FULL' },
    }]);
    updateMany.mockResolvedValue({ count: 1 });
    const body = await (await post()).json();
    expect(body.cancelled).toBe(1);
    expect(body.applied).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
});
