jest.mock('@/lib/prisma', () => ({ prisma: { demoRequest: { findFirst: jest.fn(async () => null), create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'r1', status: 'new', ...data })) } } }));
jest.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: async () => null, PUBLIC_RULES: { demoRequest: {} } }));

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from './route';

const post = (body: unknown) => POST(new NextRequest('http://x/api/demo-requests', { method: 'POST', body: JSON.stringify(body) }));
const form = { name: '张三', company: '某能源公司', email: 'zs@example.cn' };

describe('预约演示：收集个人信息前须明示同意', () => {
  it.each([undefined, false, 'true', 1])('consent=%p：422，什么都不写库', async (consent) => {
    const res = await post({ ...form, consent });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe('CONSENT_REQUIRED');
    expect(prisma.demoRequest.create).not.toHaveBeenCalled();
  });

  it('consent=true：正常入库，且 consent 字段本身不写进库', async () => {
    const res = await post({ ...form, consent: true });
    expect(res.status).toBe(201);
    const data = jest.mocked(prisma.demoRequest.create).mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty('consent');
    expect(data.email).toBe('zs@example.cn');
  });
});
