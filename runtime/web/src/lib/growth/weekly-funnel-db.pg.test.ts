/**
 * 真实 PostgreSQL 上跑周漏斗（只在设置 ENERGY_FUNNEL_TEST_DATABASE_URL 时运行，指向一个可随意清空的测试库，
 * 先用 `prisma db push` 建好表）。验证：同一份数据得到同样的数字、只读事务写不进去、
 * 只有四张表 SELECT 权限的角色也能跑、#173 的来源表有和没有两种情况、会话时区不是 UTC 时也对。
 */
import { PrismaClient } from '@prisma/client';
import { reportFromDatabase } from './weekly-funnel-db';
import {
    EXPECTED_SOURCES_W1, EXPECTED_SOURCES_W2, EXPECTED_W1, EXPECTED_W2, IDENTIFIERS, metrics, NOW, PAYMENTS, PHONE,
    SUBSCRIPTION_END_DATES, USERS,
} from './weekly-funnel.fixture';

const URL_ = process.env.ENERGY_FUNNEL_TEST_DATABASE_URL || '';
const maybe = URL_ ? describe : describe.skip;
const ROLE = 'funnel_ro_test';

function withUser(url: string, user: string): string {
    const u = new URL(url);
    u.username = user;
    u.password = '';
    return u.toString();
}

maybe('真实 PostgreSQL', () => {
    let admin: PrismaClient;

    beforeAll(async () => {
        admin = new PrismaClient({ datasources: { db: { url: URL_ } } });
        await admin.$executeRawUnsafe('DROP TABLE IF EXISTS "signup_source_events"');
        await admin.$executeRawUnsafe('TRUNCATE "payments", "subscriptions", "users" CASCADE');
        for (const u of USERS) {
            await admin.user.create({
                data: {
                    id: u.id, email: `${u.id}@account.invalid`, phone: u.id === 'user-mid-w2' ? PHONE : null,
                    createdAt: new Date(u.createdAt), deletedAt: u.deleted ? new Date('2026-11-12T00:00:00Z') : null,
                },
            });
        }
        for (const p of PAYMENTS) {
            await admin.payment.create({
                data: {
                    id: p.id, orderNo: `NO-${p.id}`, userId: p.userId, plan: 'PRO', billingPeriod: 'monthly',
                    amount: p.amount, currency: p.currency, status: p.status, paidAt: p.paidAt ? new Date(p.paidAt) : null,
                },
            });
        }
        for (const s of SUBSCRIPTION_END_DATES) {
            await admin.subscription.create({ data: { userId: s.userId, plan: 'PRO', endDate: new Date(s.endDate) } });
        }
        await admin.$executeRawUnsafe(`DO $$ BEGIN CREATE ROLE ${ROLE} LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
        await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);
        await admin.$executeRawUnsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${ROLE}`);
        await admin.$executeRawUnsafe(`GRANT SELECT ON "users", "payments", "subscriptions" TO ${ROLE}`);
    });

    afterAll(async () => {
        await admin.$executeRawUnsafe('DROP TABLE IF EXISTS "signup_source_events"');
        await admin.$executeRawUnsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${ROLE}`);
        await admin.$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM ${ROLE}`);
        await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS ${ROLE}`);
        await admin.$disconnect();
    });

    test('会话时区是 Asia/Shanghai 时，数字仍按上海周算对', async () => {
        const tz = await admin.$queryRawUnsafe<{ TimeZone: string }[]>('SHOW TimeZone');
        expect(Object.values(tz[0])[0]).not.toBe('UTC');
        const body = await reportFromDatabase(admin, { weekStart: '2026-11-15', weeks: '2' }, NOW);
        expect(body.weeks.map(metrics)).toEqual([EXPECTED_W1, EXPECTED_W2]);
        expect(body.weeks.every((w) => w.signups_by_source === null)).toBe(true);
        const text = JSON.stringify(body);
        for (const id of IDENTIFIERS) expect(text).not.toContain(id);
    });

    test('只有 users / payments / subscriptions SELECT 权限的角色也能跑', async () => {
        const ro = new PrismaClient({ datasources: { db: { url: withUser(URL_, ROLE) } } });
        try {
            await expect(ro.verificationCode.findMany({ take: 1 })).rejects.toThrow();
            const body = await reportFromDatabase(ro, { weekStart: '2026-11-15', weeks: '2' }, NOW);
            expect(body.weeks.map(metrics)).toEqual([EXPECTED_W1, EXPECTED_W2]);
        } finally {
            await ro.$disconnect();
        }
    });

    test('只读事务里写不进去', async () => {
        await expect(admin.$transaction(async (tx) => {
            await tx.$executeRaw`SET TRANSACTION READ ONLY`;
            await tx.user.create({ data: { email: 'should-not-exist@account.invalid' } });
        })).rejects.toThrow(/read-only|只读/i);
        expect(await admin.user.count({ where: { email: 'should-not-exist@account.invalid' } })).toBe(0);
    });

    test('#173 来源表存在时按周统计（表结构取自 #173 的迁移）', async () => {
        await admin.$executeRawUnsafe(`CREATE TABLE "signup_source_events" (
            "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
            "source" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
        let i = 0;
        for (const u of USERS) {
            if (!u.source) continue;
            await admin.$executeRawUnsafe(
                'INSERT INTO "signup_source_events" ("id", "userId", "source") VALUES ($1, $2, $3)', `e${i++}`, u.id, u.source);
        }
        await admin.$executeRawUnsafe(`GRANT SELECT ON "signup_source_events" TO ${ROLE}`);
        const ro = new PrismaClient({ datasources: { db: { url: withUser(URL_, ROLE) } } });
        try {
            const body = await reportFromDatabase(ro, { weekStart: '2026-11-15', weeks: '2' }, NOW);
            expect(body.weeks.map((w) => w.signups_by_source)).toEqual([EXPECTED_SOURCES_W1, EXPECTED_SOURCES_W2]);
            expect(body.weeks.map(metrics)).toEqual([EXPECTED_W1, EXPECTED_W2]);
        } finally {
            await ro.$disconnect();
        }
    });
});
