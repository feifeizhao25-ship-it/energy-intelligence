import {
    buildReport, checkParams, configuredToken, FunnelSource, payerDigest, parseWeekStart, READONLY_TOKEN_ENV,
    shanghaiIso, SOURCE_TABLE_MISSING_NOTE, tokenMatches, bearerToken, WeekError, weekStartOf, yuanToFen,
} from './weekly-funnel';
import {
    EXPECTED_SOURCES_W1, EXPECTED_SOURCES_W2, EXPECTED_W1, EXPECTED_W2, IDENTIFIERS, metrics, NOW, PAYMENTS,
    SUBSCRIPTION_END_DATES, USERS, W0, W1, W2,
} from './weekly-funnel.fixture';

function memorySource(opts: { sourceTable?: boolean; empty?: boolean } = {}): FunnelSource {
    const users = opts.empty ? [] : USERS;
    const payments = opts.empty ? [] : PAYMENTS;
    const subs = opts.empty ? [] : SUBSCRIPTION_END_DATES;
    const t = (s: string) => new Date(s).getTime();
    return {
        async countSignups(start, end) {
            return users.filter((u) => t(u.createdAt) >= start.getTime() && t(u.createdAt) < end.getTime()).length;
        },
        async completedPayments(before) {
            return payments
                .filter((p) => p.status === 'completed' && p.currency === 'CNY' && p.paidAt && t(p.paidAt) < before.getTime())
                .map((p) => ({ payer: payerDigest(p.userId), key: p.id, paidAt: new Date(p.paidAt as string), amountFen: yuanToFen(p.amount) }));
        },
        async subscriptionEndDates(from, to) {
            return subs.map((s) => new Date(s.endDate)).filter((d) => d >= from && d < to);
        },
        async signupSources(start, end) {
            if (!opts.sourceTable) return null;
            const out: Record<string, number> = {};
            for (const u of users) {
                if (u.source && t(u.createdAt) >= start.getTime() && t(u.createdAt) < end.getTime()) {
                    out[u.source] = (out[u.source] || 0) + 1;
                }
            }
            return out;
        },
    };
}

const report = (weekStart: string | null, weeks: string | null, source = memorySource(), now = NOW) =>
    buildReport(source, { weekStart, weeks }, now);

describe('周边界（上海时间周日到周六）', () => {
    test('周六 23:59:59 与周日 00:00 分在两周', () => {
        expect(shanghaiIso(weekStartOf(new Date('2026-11-14T15:59:59Z')))).toBe(W1);
        expect(shanghaiIso(weekStartOf(new Date('2026-11-14T16:00:00Z')))).toBe(W2);
        expect(shanghaiIso(weekStartOf(new Date('2026-11-21T15:59:59Z')))).toBe(W2);
        expect(shanghaiIso(weekStartOf(new Date('2026-11-21T16:00:00Z')))).toBe('2026-11-22T00:00:00+08:00');
        expect(parseWeekStart('2026-11-15', NOW)).toBe(new Date('2026-11-14T16:00:00Z').getTime());
    });

    test('周的标签、complete 和默认四周', async () => {
        const body = await report('2026-11-15', '3');
        expect(body.weeks.map((w) => w.week_start)).toEqual([W0, W1, W2]);
        expect(body.weeks[1].week_end).toBe('2026-11-14T23:59:59+08:00');
        expect(body.weeks.map((w) => w.complete)).toEqual([true, true, false]);
        const dflt = await report(null, null);
        expect(dflt.weeks).toHaveLength(4);
        expect(dflt.weeks[3].week_start).toBe(W2);
    });

    test.each([
        ['2026-11-16', null], ['2026/11/15', null], ['2026-02-30', null], ['2026-11-22', null],
        [null, '0'], [null, '27'], [null, 'abc'], [null, '1.5'],
    ])('参数不合法：week_start=%s weeks=%s', (weekStart, weeks) => {
        expect(() => checkParams({ weekStart, weeks }, NOW)).toThrow(WeekError);
    });
});

describe('每个字段', () => {
    test('新注册、新付费、续费、订单金额、到期', async () => {
        const body = await report('2026-11-15', '2');
        expect(body.weeks.map(metrics)).toEqual([EXPECTED_W1, EXPECTED_W2]);
        expect(body.currency).toBe('CNY');
        expect(body.money_unit).toBe('分');
    });

    test('窗口之前已经付过款的人，本周再付算续费不算新付费', async () => {
        const body = await report('2026-11-08', '1');
        expect(body.weeks[0].new_paid).toBe(2);
        expect(body.weeks[0].renewals).toBe(1);
    });

    test('到期只算已经过去的；时间推后，未来那条也算进来', async () => {
        const later = await report('2026-11-15', '1', memorySource(), new Date('2026-11-21T00:00:00Z'));
        expect(later.weeks[0].expirations).toBe(3);
    });

    test('退款没有数据来源：null 加说明', async () => {
        const body = await report(null, '2');
        expect(body.weeks.every((w) => w.refund_amount_fen === null)).toBe(true);
        expect(body.field_notes.refund_amount_fen).toMatch(/^暂无数据/);
    });

    test('来源表不存在：signups_by_source 为 null，说明写明不是 0', async () => {
        const body = await report('2026-11-15', '2');
        expect(body.weeks.every((w) => w.signups_by_source === null)).toBe(true);
        expect(body.field_notes.signups_by_source).toBe(SOURCE_TABLE_MISSING_NOTE);
    });

    test('来源表存在：代码 → 人数，加 unanswered', async () => {
        const body = await report('2026-11-15', '2', memorySource({ sourceTable: true }));
        expect(body.weeks.map((w) => w.signups_by_source)).toEqual([EXPECTED_SOURCES_W1, EXPECTED_SOURCES_W2]);
        expect(body.field_notes.signups_by_source).not.toMatch(/^暂无数据/);
    });

    test('空库全部为 0（退款仍为 null）', async () => {
        const body = await report(null, '1', memorySource({ empty: true }));
        expect(metrics(body.weeks[0])).toEqual({
            new_signups: 0, new_paid: 0, renewals: 0, order_amount_fen: 0, refund_amount_fen: null, expirations: 0,
        });
    });

    test('元转分按字符串处理', () => {
        expect(yuanToFen('10.05')).toBe(1005);
        expect(yuanToFen('199')).toBe(19900);
        expect(yuanToFen('0.1')).toBe(10);
        expect(yuanToFen({ toString: () => '68.00' })).toBe(6800);
        expect(yuanToFen('abc')).toBe(0);
    });
});

describe('不出身份', () => {
    test('只有允许的键，全文没有任何测试身份', async () => {
        const body = await report('2026-11-15', '3', memorySource({ sourceTable: true }));
        expect(Object.keys(body).sort()).toEqual(
            ['currency', 'field_notes', 'generated_at', 'market', 'money_unit', 'scope', 'timezone', 'week_definition', 'weeks'],
        );
        for (const w of body.weeks) {
            expect(Object.keys(w).sort()).toEqual([
                'complete', 'expirations', 'new_paid', 'new_signups', 'order_amount_fen', 'refund_amount_fen',
                'renewals', 'signups_by_source', 'week_end', 'week_start',
            ]);
        }
        const text = JSON.stringify(body);
        for (const id of IDENTIFIERS) expect(text).not.toContain(id);
        for (const word of ['userId', 'user_id', 'phone', 'email', 'orderNo', 'payer']) expect(text).not.toContain(word);
    });
});

describe('令牌', () => {
    test('没配、为空、与已有口令相同都算关闭', () => {
        expect(configuredToken({})).toBe('');
        expect(configuredToken({ [READONLY_TOKEN_ENV]: '   ' })).toBe('');
        expect(configuredToken({ [READONLY_TOKEN_ENV]: ' t ' })).toBe('t');
        for (const name of ['NENGJIAN_INTERNAL_TOKEN', 'CRON_SECRET', 'NEXTAUTH_SECRET']) {
            expect(configuredToken({ [READONLY_TOKEN_ENV]: 'same', [name]: 'same' })).toBe('');
        }
    });

    test('比较与 Bearer 解析', () => {
        expect(tokenMatches('abc', 'abc')).toBe(true);
        expect(tokenMatches('abc', 'abcd')).toBe(false);
        expect(tokenMatches('', 'abc')).toBe(false);
        expect(bearerToken('Bearer x')).toBe('x');
        expect(bearerToken('bearer x')).toBe('x');
        expect(bearerToken('Basic x')).toBe('');
        expect(bearerToken(null)).toBe('');
    });
});
