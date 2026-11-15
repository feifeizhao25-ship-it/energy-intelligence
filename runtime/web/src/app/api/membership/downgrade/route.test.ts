jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 'u1' } })) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn() }, subscription: { update: jest.fn() } } }));

import { prisma } from '@/lib/prisma';
import { POST } from './route';

const find = prisma.user.findUnique as jest.Mock;
const update = prisma.subscription.update as jest.Mock;
const end = new Date(Date.now() + 30 * 86_400_000);

function post(plan: string) {
    return POST(new Request('http://x/api/membership/downgrade', {
        method: 'POST', body: JSON.stringify({ plan }), headers: { 'content-type': 'application/json' },
    }));
}

beforeEach(() => {
    find.mockResolvedValue({
        id: 'u1', plan: 'FULL', planExpireAt: end,
        subscription: { id: 'sub1', endDate: end, plan: 'FULL' },
    });
    update.mockReset();
    update.mockResolvedValue({});
});

test('有效期内只登记更低档位，不改当前权益', async () => {
    const response = await post('PRO');
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { scheduledPlan: 'PRO', scheduledFromPlan: 'FULL', scheduledEffectiveAt: end },
    });
    expect(find).toHaveBeenCalled();
});

test('升级和同档续费不走降级', async () => {
    expect((await post('ENTERPRISE')).status).toBe(400);
    expect((await post('FULL')).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
});
