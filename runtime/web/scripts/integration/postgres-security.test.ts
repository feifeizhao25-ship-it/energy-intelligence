/** Opt-in integration tests. Only an isolated localhost test database is accepted. */

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  if (parsed.hostname !== '127.0.0.1' || parsed.pathname !== '/energy_integration_test') {
    throw new Error('Integration tests require the isolated localhost energy_integration_test database');
  }
}

jest.mock('@/lib/prisma', () => {
  const { PrismaClient } = require('@prisma/client');
  return { prisma: new PrismaClient({ datasources: { db: { url: process.env.INTEGRATION_DATABASE_URL || 'postgresql://unused@127.0.0.1/unused' } } }) };
});
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
import { prisma } from '@/lib/prisma';
import { verifySmsCode } from '@/lib/auth/sms-verify';
import { prismaCodeStore } from '@/lib/auth/sms-store';
import { consumeAiCall, prismaQuotaStore } from '@/lib/ai/quota-guard';
import { incrementUsage } from '@/lib/membership/usage';
import { eraseUser, exportUserData } from '@/lib/account/erasure';

const integration = databaseUrl ? describe : describe.skip;
integration('real PostgreSQL security regressions', () => {
  const id = `security-${Date.now()}`;
  const otherId = `${id}-other`;
  const phone = '13800009922';

  beforeAll(async () => {
    await prisma.user.createMany({ data: [
      { id, email: `${id}@test.invalid`, phone, name: '测试用户' },
      { id: otherId, email: `${otherId}@test.invalid`, name: '另一用户' },
    ] });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [id, otherId] } } });
    await prisma.verificationCode.deleteMany({ where: { phone: { in: [phone, '13900009922'] } } });
    await prisma.$disconnect();
  });

  it('30 concurrent guesses cannot overwrite the five-attempt limit', async () => {
    const code = await prisma.verificationCode.create({ data: { phone, code: '654321', expiresAt: new Date(Date.now() + 600000) } });
    const responses = await Promise.all(Array.from({ length: 30 }, () => verifySmsCode(prismaCodeStore, phone, '111111')));
    expect(responses.every((r) => !r.ok)).toBe(true);
    expect((await prisma.verificationCode.findUniqueOrThrow({ where: { id: code.id } })).attempts).toBe(5);
    expect((await verifySmsCode(prismaCodeStore, phone, '654321')).ok).toBe(false);
  });

  it('a consumed newer code never revives an older unused code', async () => {
    const number = '13900009922';
    await prisma.verificationCode.createMany({ data: [
      { phone: number, code: '111111', expiresAt: new Date(Date.now() + 600000), createdAt: new Date(Date.now() - 60000) },
      { phone: number, code: '222222', expiresAt: new Date(Date.now() + 600000), used: true },
    ] });
    expect((await verifySmsCode(prismaCodeStore, number, '111111')).ok).toBe(false);
  });

  it('30 requests after midnight share three free AI slots', async () => {
    await prisma.user.update({ where: { id }, data: { dailyAiCalls: 3, lastResetAt: new Date(Date.now() - 86400000) } });
    const results = await Promise.all(Array.from({ length: 30 }, () => consumeAiCall(prismaQuotaStore, id)));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).dailyAiCalls).toBe(3);
  });

  it('other feature increments cannot wipe concurrent AI usage at rollover', async () => {
    await prisma.user.update({ where: { id }, data: { dailyAiCalls: 3, dailyCalculations: 9, lastResetAt: new Date(Date.now() - 86400000) } });
    const [results] = await Promise.all([
      Promise.all(Array.from({ length: 30 }, () => consumeAiCall(prismaQuotaStore, id))),
      Promise.all(Array.from({ length: 8 }, () => incrementUsage(id, 'calculation'))),
    ]);
    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(user.dailyAiCalls).toBe(3);
    expect(user.dailyCalculations).toBe(8);
  });

  it('export and erasure use migrated tables and preserve other users and payment records', async () => {
    await prisma.project.createMany({ data: [
      { userId: id, name: '本人项目', type: 'SOLAR' },
      { userId: otherId, name: '其他人的项目', type: 'SOLAR' },
    ] });
    const subscription = await prisma.subscription.create({ data: { userId: id, plan: 'PRO', endDate: new Date(Date.now() + 86400000) } });
    const payment = await prisma.payment.create({ data: { userId: id, subscriptionId: subscription.id, orderNo: id, plan: 'PRO', billingPeriod: 'monthly', amount: 10, status: 'completed' } });
    const exported = await exportUserData(prisma as never, id);
    expect(JSON.stringify(exported)).not.toContain(otherId);
    const result = await eraseUser(prisma as never, id);
    expect(result.failed).toEqual([]);
    expect(await prisma.project.count({ where: { userId: id } })).toBe(0);
    expect(await prisma.project.count({ where: { userId: otherId } })).toBe(1);
    expect(await prisma.payment.findUnique({ where: { id: payment.id } })).not.toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();
    expect((await consumeAiCall(prismaQuotaStore, id)).ok).toBe(false);
  });
});
