jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }));

import * as routeModule from './route';
import { prisma } from '@/lib/prisma';
import { READONLY_TOKEN_ENV, FORBIDDEN_TOKEN_REUSE_ENVS } from '@/lib/growth/weekly-funnel';
import {
    EXPECTED_SOURCES_W1, EXPECTED_SOURCES_W2, EXPECTED_W1, EXPECTED_W2, IDENTIFIERS, metrics, PAYMENTS,
    SUBSCRIPTION_END_DATES, USERS,
} from '@/lib/growth/weekly-funnel.fixture';

const { GET } = routeModule;
const TOKEN = 'funnel-readonly-test-token-0123456789';
const transaction = prisma.$transaction as unknown as jest.Mock;

type Call = { kind: string; arg?: unknown; sql?: string };

function fakeTx(calls: Call[], sourceTable: boolean) {
    const t = (s: string) => new Date(s).getTime();
    return {
        $executeRaw: jest.fn(async (strings: TemplateStringsArray) => {
            calls.push({ kind: 'execute', sql: strings.join('?') });
            return 0;
        }),
        $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
            const sql = strings.join('?');
            calls.push({ kind: 'query', sql });
            if (sql.includes('to_regclass')) return [{ present: sourceTable }];
            const [start, end] = values.map((v) => new Date(String(v)).getTime());
            const out: Record<string, number> = {};
            for (const u of USERS) {
                if (u.source && t(u.createdAt) >= start && t(u.createdAt) < end) out[u.source] = (out[u.source] || 0) + 1;
            }
            return Object.entries(out).map(([source, n]) => ({ source, n }));
        }),
        user: {
            count: jest.fn(async (arg: any) => {
                calls.push({ kind: 'user.count', arg });
                const { gte, lt } = arg.where.createdAt;
                return USERS.filter((u) => t(u.createdAt) >= gte.getTime() && t(u.createdAt) < lt.getTime()).length;
            }),
        },
        payment: {
            findMany: jest.fn(async (arg: any) => {
                calls.push({ kind: 'payment.findMany', arg });
                return PAYMENTS.filter((p) => p.status === arg.where.status && p.currency === arg.where.currency
                    && p.paidAt && t(p.paidAt) < arg.where.paidAt.lt.getTime())
                    .map((p) => ({ id: p.id, userId: p.userId, amount: { toString: () => p.amount }, paidAt: new Date(p.paidAt as string) }));
            }),
        },
        subscription: {
            findMany: jest.fn(async (arg: any) => {
                calls.push({ kind: 'subscription.findMany', arg });
                return SUBSCRIPTION_END_DATES.map((s) => ({ endDate: new Date(s.endDate) }))
                    .filter((s) => s.endDate >= arg.where.endDate.gte && s.endDate < arg.where.endDate.lt);
            }),
        },
    };
}

let calls: Call[];
let sourceTable = false;
beforeEach(() => {
    calls = [];
    sourceTable = false;
    for (const name of [READONLY_TOKEN_ENV, ...FORBIDDEN_TOKEN_REUSE_ENVS]) delete process.env[name];
    transaction.mockReset();
    transaction.mockImplementation(async (cb: (tx: unknown) => unknown, opts: unknown) => {
        calls.push({ kind: 'transaction', arg: opts });
        return cb(fakeTx(calls, sourceTable));
    });
    jest.useFakeTimers({ now: new Date('2026-11-19T04:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
});
afterEach(() => jest.useRealTimers());

const req = (query = '', headers: Record<string, string> = {}) =>
    new Request(`http://localhost/api/growth/funnel/weekly${query}`, { headers });
const auth = (token = TOKEN, scheme = 'Bearer') => ({ authorization: `${scheme} ${token}` });

test('没配令牌或令牌为空：503，不碰数据库', async () => {
    expect((await GET(req('', auth()))).status).toBe(503);
    process.env[READONLY_TOKEN_ENV] = '   ';
    expect((await GET(req('', auth('   ')))).status).toBe(503);
    expect(transaction).not.toHaveBeenCalled();
});

test('缺令牌、令牌错、方案不对、放在查询参数、只有登录 cookie：一律 401，不碰数据库', async () => {
    process.env[READONLY_TOKEN_ENV] = TOKEN;
    const cases: Request[] = [
        req(),
        req('', auth(TOKEN + 'x')),
        req('', auth(TOKEN.slice(0, -1))),
        req('', auth(TOKEN, 'Basic')),
        req('', { authorization: TOKEN }),
        req(`?token=${TOKEN}`),
        req('', { cookie: 'next-auth.session-token=whatever' }),
    ];
    for (const r of cases) expect((await GET(r)).status).toBe(401);
    expect(transaction).not.toHaveBeenCalled();
});

test('与站内口令相同则关闭；站内口令打不开它', async () => {
    process.env[READONLY_TOKEN_ENV] = TOKEN;
    process.env.NENGJIAN_INTERNAL_TOKEN = 'internal-token-value';
    process.env.CRON_SECRET = 'cron-secret-value';
    expect((await GET(req('', auth('internal-token-value')))).status).toBe(401);
    expect((await GET(req('', auth('cron-secret-value')))).status).toBe(401);
    for (const name of ['NENGJIAN_INTERNAL_TOKEN', 'CRON_SECRET', 'NEXTAUTH_SECRET']) {
        const before = process.env[name];
        process.env[name] = TOKEN;
        expect((await GET(req('', auth()))).status).toBe(503);
        process.env[name] = before ?? 'x';
    }
    expect(transaction).not.toHaveBeenCalled();
});

test('只导出 GET（其他方法由 Next 返回 405）', () => {
    const exported = Object.keys(routeModule).filter((k) => /^[A-Z]+$/.test(k));
    expect(exported).toEqual(['GET']);
});

test('参数不合法：422，不开事务', async () => {
    process.env[READONLY_TOKEN_ENV] = TOKEN;
    for (const q of ['?week_start=2026-11-16', '?week_start=2026-11-22', '?weeks=99', '?weeks=abc']) {
        expect((await GET(req(q, auth()))).status).toBe(422);
    }
    expect(transaction).not.toHaveBeenCalled();
});

test('正确令牌：200，数字对，只读事务先开，只查统计要用的列', async () => {
    process.env[READONLY_TOKEN_ENV] = TOKEN;
    const res = await GET(req('?week_start=2026-11-15&weeks=2', auth()));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.weeks.map(metrics)).toEqual([EXPECTED_W1, EXPECTED_W2]);
    expect(body.weeks.every((w: any) => w.signups_by_source === null)).toBe(true);

    expect(calls[0].kind).toBe('transaction');
    expect(calls[1]).toMatchObject({ kind: 'execute', sql: 'SET TRANSACTION READ ONLY' });
    expect(calls[2]).toMatchObject({ kind: 'execute', sql: 'SET LOCAL statement_timeout = 5000' });
    const pay = calls.find((c) => c.kind === 'payment.findMany')?.arg as any;
    expect(pay.select).toEqual({ id: true, userId: true, amount: true, paidAt: true });
    expect(pay.where).toMatchObject({ status: 'completed', currency: 'CNY' });
    const sub = calls.find((c) => c.kind === 'subscription.findMany')?.arg as any;
    expect(sub.select).toEqual({ endDate: true });
    for (const c of calls.filter((c) => c.sql)) {
        expect(c.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|TRUNCATE)\b/i);
    }

    const text = JSON.stringify(body);
    for (const id of IDENTIFIERS) expect(text).not.toContain(id);
    for (const word of ['userId', 'phone', 'email', 'orderNo']) expect(text).not.toContain(word);
});

test('来源表存在时按周给出代码 → 人数', async () => {
    process.env[READONLY_TOKEN_ENV] = TOKEN;
    sourceTable = true;
    const body = await (await GET(req('?week_start=2026-11-15&weeks=2', auth()))).json();
    expect(body.weeks.map((w: any) => w.signups_by_source)).toEqual([EXPECTED_SOURCES_W1, EXPECTED_SOURCES_W2]);
});

test('数据库出错：503，不把错误原文给出去', async () => {
    process.env[READONLY_TOKEN_ENV] = TOKEN;
    transaction.mockRejectedValueOnce(new Error('connect ECONNREFUSED postgres:5432 password=hunter2'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await GET(req('', auth()));
    expect(res.status).toBe(503);
    expect(await res.text()).not.toMatch(/ECONNREFUSED|hunter2/);
    spy.mockRestore();
});
