import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 'u1' } })) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/payments/alipay', () => ({
  canonicalPrice: jest.fn(() => 198),
  createAlipayPagePayUrl: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn(async () => ({ plan: 'FREE', planExpireAt: null })) }, payment: { create: jest.fn() } } }));

import { createAlipayPagePayUrl } from '@/lib/payments/alipay';
import { prisma } from '@/lib/prisma';
import { POST } from './route';

const buy = () => POST(new NextRequest('http://x/api/membership/upgrade', { method: 'POST', body: JSON.stringify({ plan: 'PRO', billingPeriod: 'monthly' }) }) as never);

describe('下单失败时给用户的提示', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => { errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined); });
  afterEach(() => errorSpy.mockRestore());

  it.each([
    '支付宝商户配置缺失：ALIPAY_PRIVATE_KEY',
    '生产环境支付宝回调地址必须使用 HTTPS',
    'error:1E08010C:DECODER routines::unsupported',
    'connect ECONNREFUSED 10.0.0.5:5432',
  ])('内部原因（%s）不外露，只告诉用户稍后重试；原因写进服务端日志', async (reason) => {
    jest.mocked(createAlipayPagePayUrl).mockImplementation(() => { throw new Error(reason); });
    const res = await buy();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.message).toBe('支付通道暂时不可用，请稍后再试；如持续失败请联系客服');
    expect(JSON.stringify(body)).not.toMatch(/ALIPAY|HTTPS|routines|ECONNREFUSED|10\.0\.0/);
    expect(errorSpy.mock.calls.flat().map(String).join(' ')).toContain(reason);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('金额与服务端价格不一致属于内部错误，同样不外露', async () => {
    jest.mocked(createAlipayPagePayUrl).mockImplementation(() => { throw new Error('订单金额与服务端会员价格不一致'); });
    const body = await (await buy()).json();
    expect(body.message).toBe('支付通道暂时不可用，请稍后再试；如持续失败请联系客服');
  });
});
