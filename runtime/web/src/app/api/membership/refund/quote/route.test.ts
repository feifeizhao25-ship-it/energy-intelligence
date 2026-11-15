jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 'u1' } })) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({ prisma: { payment: { findFirst: jest.fn() } } }));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { POST } from './route';

const find = prisma.payment.findFirst as jest.Mock;
const session = getServerSession as jest.Mock;

function post(body: unknown) {
    return POST(new Request('http://x/api/membership/refund/quote', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
    }));
}

beforeEach(() => {
    session.mockResolvedValue({ user: { id: 'u1' } });
    find.mockReset();
});

test('未登录不能测算', async () => {
    session.mockResolvedValue(null);
    expect((await post({ orderNo: 'ENE1' })).status).toBe(401);
    expect(find).not.toHaveBeenCalled();
});

test('调用方填写的金额一律拒绝，并且不查订单', async () => {
    const response = await post({ orderNo: 'ENE1', paid_amount_cny: '99999.00' });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: '退款金额以已支付订单为准，不能由请求自行填写' });
    expect(find).not.toHaveBeenCalled();
});

test('只按本人已支付订单的实付金额和服务周期测算', async () => {
    find.mockResolvedValue({
        orderNo: 'ENE1', userId: 'u1', status: 'completed', amount: '365.00',
        serviceStart: new Date('2026-01-01T00:00:00.000Z'),
        serviceEnd: new Date('2027-01-01T00:00:00.000Z'),
    });
    const response = await post({ orderNo: 'ENE1' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('quote_only');
    expect(body.paidCny).toBe('365.00');
    expect(Number(body.refundCny)).toBeLessThanOrEqual(365);
    expect(find).toHaveBeenCalledWith({ where: { orderNo: 'ENE1', userId: 'u1' } });
});

test('别人的订单和缺少服务周期的历史订单都不出测算', async () => {
    find.mockResolvedValue(null);
    expect((await post({ orderNo: 'ENE-OTHER' })).status).toBe(404);
    find.mockResolvedValue({ orderNo: 'ENE-OLD', status: 'completed', amount: '1980.00', serviceStart: null, serviceEnd: null });
    expect((await post({ orderNo: 'ENE-OLD' })).status).toBe(409);
});
