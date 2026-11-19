/** 周漏斗测试共用的数据（内存测试、路由测试、真实 PostgreSQL 测试都用这一份）。 */
export const NOW = new Date('2026-11-19T04:00:00Z'); // 上海时间周四 12:00
export const W0 = '2026-11-01T00:00:00+08:00';
export const W1 = '2026-11-08T00:00:00+08:00';
export const W2 = '2026-11-15T00:00:00+08:00';
export const PHONE = '13800138000';

export type FixtureUser = { id: string; createdAt: string; deleted?: boolean; source?: string };
export const USERS: FixtureUser[] = [
    { id: 'user-sat-last-second', createdAt: '2026-11-14T15:59:59Z', source: 'douyin' }, // 上海周六 23:59:59 → W1
    { id: 'user-deleted-w1', createdAt: '2026-11-10T02:00:00Z', deleted: true },
    { id: 'user-sun-first-second', createdAt: '2026-11-14T16:00:00Z', source: 'xiaohongshu' }, // 上海周日 00:00 → W2
    { id: 'user-mid-w2', createdAt: '2026-11-16T03:00:00Z' },
    // 付款用户在窗口之前注册，不计入新注册；来源也不计入
    ...['payer-1', 'payer-2', 'payer-3', 'payer-4', 'payer-5', 'payer-6', 'payer-7', 'payer-8'].map((id) => ({
        id, createdAt: '2026-10-01T00:00:00Z', source: 'zhihu',
    })),
];

export type FixturePayment = {
    id: string; userId: string; amount: string; currency: string; status: string; paidAt: string | null;
};
export const PAYMENTS: FixturePayment[] = [
    { id: 'pay-0', userId: 'payer-1', amount: '19.90', currency: 'CNY', status: 'completed', paidAt: '2026-11-02T01:05:00Z' },
    { id: 'pay-a', userId: 'payer-1', amount: '199.00', currency: 'CNY', status: 'completed', paidAt: '2026-11-09T02:00:00Z' },
    { id: 'pay-b', userId: 'payer-1', amount: '199.00', currency: 'CNY', status: 'completed', paidAt: '2026-11-16T05:00:00Z' },
    { id: 'pay-c', userId: 'payer-2', amount: '68.00', currency: 'CNY', status: 'completed', paidAt: '2026-11-10T01:00:00Z' },
    { id: 'pay-d', userId: 'payer-3', amount: '10.05', currency: 'CNY', status: 'completed', paidAt: '2026-11-14T15:59:59Z' },
    { id: 'pay-e', userId: 'payer-4', amount: '30.00', currency: 'CNY', status: 'completed', paidAt: '2026-11-14T16:00:00Z' },
    { id: 'pay-f', userId: 'payer-5', amount: '68.00', currency: 'CNY', status: 'pending', paidAt: null },
    { id: 'pay-g', userId: 'payer-6', amount: '68.00', currency: 'CNY', status: 'failed', paidAt: '2026-11-16T01:00:00Z' },
    { id: 'pay-h', userId: 'payer-7', amount: '9.99', currency: 'USD', status: 'completed', paidAt: '2026-11-16T01:00:00Z' },
    { id: 'pay-i', userId: 'payer-8', amount: '199.00', currency: 'CNY', status: 'refunded', paidAt: '2026-11-16T02:00:00Z' },
];

export const SUBSCRIPTION_END_DATES: { userId: string; endDate: string }[] = [
    { userId: 'payer-1', endDate: '2026-11-12T00:00:00Z' },
    { userId: 'payer-2', endDate: '2026-11-14T15:59:59Z' },
    { userId: 'payer-3', endDate: '2026-11-14T16:00:00Z' },
    { userId: 'payer-4', endDate: '2026-11-17T00:00:00Z' },
    { userId: 'payer-5', endDate: '2026-11-20T00:00:00Z' }, // 还没到
];

export const EXPECTED_W1 = {
    new_signups: 2, new_paid: 2, renewals: 1, order_amount_fen: 19900 + 6800 + 1005,
    refund_amount_fen: null, expirations: 2,
};
export const EXPECTED_W2 = {
    new_signups: 2, new_paid: 1, renewals: 1, order_amount_fen: 19900 + 3000,
    refund_amount_fen: null, expirations: 2,
};
export const EXPECTED_SOURCES_W1 = { douyin: 1, unanswered: 1 };
export const EXPECTED_SOURCES_W2 = { xiaohongshu: 1, unanswered: 1 };

export const IDENTIFIERS = [
    ...USERS.map((u) => u.id),
    ...PAYMENTS.map((p) => p.id),
    PHONE,
];

export function metrics(week: Record<string, unknown>) {
    const { new_signups, new_paid, renewals, order_amount_fen, refund_amount_fen, expirations } = week;
    return { new_signups, new_paid, renewals, order_amount_fen, refund_amount_fen, expirations };
}
