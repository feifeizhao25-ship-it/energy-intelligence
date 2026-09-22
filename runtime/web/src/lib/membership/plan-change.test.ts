import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 'u1' } })) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/payments/alipay', () => ({
  canonicalPrice: jest.fn(() => 398),
  createAlipayPagePayUrl: jest.fn(() => 'https://openapi.alipay.com/gateway.do?x=1'),
}));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn() }, payment: { create: jest.fn() } } }));

import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/membership/upgrade/route';

const buy = (plan: string) => POST(new NextRequest('http://x/api/membership/upgrade', { method: 'POST', body: JSON.stringify({ plan, billingPeriod: 'monthly' }) }) as never);

describe('会员有效期内更换方案', () => {
  it('专业版有效期内买全能版被拒，不再把剩余时长按全能版计', async () => {
    jest.mocked(prisma.user.findUnique).mockResolvedValue({ plan: 'PRO', planExpireAt: new Date(Date.now() + 20 * 86400e3) } as never);
    const res = await buy('FULL');
    expect(res.status).toBe(409);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('同方案续费、到期后换方案照常下单', async () => {
    jest.mocked(prisma.user.findUnique).mockResolvedValue({ plan: 'PRO', planExpireAt: new Date(Date.now() + 86400e3) } as never);
    expect((await buy('PRO')).status).toBe(200);
    jest.mocked(prisma.user.findUnique).mockResolvedValue({ plan: 'PRO', planExpireAt: new Date(Date.now() - 86400e3) } as never);
    expect((await buy('FULL')).status).toBe(200);
  });
});
