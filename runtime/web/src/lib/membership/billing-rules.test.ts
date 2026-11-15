import { decideScheduledDowngrade, isLowerTier, refundQuote } from './billing-rules';

const start = new Date('2026-01-01T00:00:00.000Z');
const end = new Date('2027-01-01T00:00:00.000Z');

test('退款按未使用天数向下取整，已结束的周期不退', () => {
    const mid = refundQuote('365.00', start, end, new Date('2026-01-11T00:00:00.000Z'));
    expect(mid.refundCny).toBe('355.00');
    expect(mid.remainingDays).toBe(355);
    expect(mid.status).toBe('quote_only');
    expect(refundQuote('1980.00', start, end, new Date('2027-02-01T00:00:00.000Z')).refundCny).toBe('0.00');
    expect(refundQuote('1980', start, end, start).refundCny).toBe('1980.00');
});

test('非法金额不能进入测算', () => {
    for (const amount of ['0', '-1', '1.001', 'NaN', '1e2', '01.00']) {
        expect(() => refundQuote(amount, start, end, start)).toThrow('金额无效');
    }
});

test('降级目标必须更低，且不能降到已停售的运维版', () => {
    expect(isLowerTier('FULL', 'PRO')).toBe(true);
    expect(isLowerTier('PRO', 'FULL')).toBe(false);
    expect(isLowerTier('ENTERPRISE', 'MAINTENANCE')).toBe(false);
    expect(isLowerTier('MAINTENANCE', 'PRO')).toBe(true);
});

test('到期且周期未变才切换续费档位；续费改过到期日则取消', () => {
    const due = new Date('2026-10-01T00:00:00.000Z');
    expect(decideScheduledDowngrade({
        storedPlan: 'FULL', scheduledPlan: 'PRO', scheduledFromPlan: 'FULL',
        scheduledEffectiveAt: due, endDate: due, now: due,
    })).toEqual({ action: 'apply', plan: 'PRO' });
    expect(decideScheduledDowngrade({
        storedPlan: 'FULL', scheduledPlan: 'PRO', scheduledFromPlan: 'FULL',
        scheduledEffectiveAt: due, endDate: new Date('2027-10-01T00:00:00.000Z'), now: due,
    }).action).toBe('wait');
    expect(decideScheduledDowngrade({
        storedPlan: 'FULL', scheduledPlan: 'PRO', scheduledFromPlan: 'FULL',
        scheduledEffectiveAt: due, endDate: new Date('2026-09-01T00:00:00.000Z'), now: due,
    }).action).toBe('cancel');
});
