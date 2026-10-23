// 国内会员计费规则（2026-10-18 定稿）的网页端纯函数。
// 只测算和登记，不调用支付渠道，也不给未付款的周期开通权益。

const RANK: Record<string, number> = {
    FREE: 0,
    PRO: 1,
    MAINTENANCE: 2,
    FULL: 3,
    TEAM: 4,
    ENTERPRISE: 5,
};

const DAY_MS = 86_400_000;

export function isLowerTier(current: string, target: string): boolean {
    if (target === 'MAINTENANCE') return false;
    const from = RANK[current];
    const to = RANK[target];
    return from !== undefined && to !== undefined && to < from;
}

export function toCents(value: string): number {
    const text = value.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('金额无效');
    const [yuan, frac = ''] = text.split('.');
    if (yuan.length > 1 && yuan.startsWith('0')) throw new Error('金额无效');
    const cents = Number(yuan) * 100 + Number(frac.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('金额无效');
    return cents;
}

function fromCents(cents: number): string {
    return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function wholeDays(start: Date, end: Date): number {
    return Math.floor((end.getTime() - start.getTime()) / DAY_MS);
}

export type RefundQuote = {
    paidCny: string;
    refundCny: string;
    remainingDays: number;
    totalDays: number;
    status: 'quote_only';
    message: string;
};

/** 未使用天数按比例退，向下取整到分。周期未开始全额，已结束不退。 */
export function refundQuote(paidCny: string, periodStart: Date, periodEnd: Date, now: Date): RefundQuote {
    const paid = toCents(paidCny);
    const totalDays = wholeDays(periodStart, periodEnd);
    if (totalDays <= 0) throw new Error('服务周期无效');
    let refund = 0;
    let remaining = 0;
    if (now.getTime() <= periodStart.getTime()) {
        refund = paid;
        remaining = totalDays;
    } else if (now.getTime() < periodEnd.getTime()) {
        remaining = wholeDays(now, periodEnd);
        refund = Math.floor((paid * remaining) / totalDays);
    }
    return {
        paidCny: fromCents(paid),
        refundCny: fromCents(refund),
        remainingDays: remaining,
        totalDays,
        status: 'quote_only',
        message: '未使用天数按比例测算，向下取整到分。这只是测算，不会自动退款；实际退款由财务在支付渠道后台办理。',
    };
}

export type DowngradeDecision =
    | { action: 'wait' }
    | { action: 'cancel'; reason: string }
    | { action: 'apply'; plan: string };

/** 到期才改下次续费档位。周期被续费改过、或档位对不上，就取消申请，不赠送新的付费周期。 */
export function decideScheduledDowngrade(row: {
    storedPlan: string;
    scheduledPlan: string | null;
    scheduledFromPlan: string | null;
    scheduledEffectiveAt: Date | null;
    endDate: Date | null;
    now: Date;
}): DowngradeDecision {
    if (!row.scheduledPlan) return { action: 'wait' };
    if (!row.endDate || row.endDate.getTime() > row.now.getTime()) return { action: 'wait' };
    const aligned = row.scheduledEffectiveAt?.getTime() === row.endDate.getTime();
    const valid = aligned
        && row.scheduledFromPlan === row.storedPlan
        && isLowerTier(row.storedPlan, row.scheduledPlan);
    if (!valid) return { action: 'cancel', reason: '订阅周期或档位已变化，或申请数据无效' };
    return { action: 'apply', plan: row.scheduledPlan };
}
