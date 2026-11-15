/** 升级补差价草稿。负责人尚未在企业微信确认，因此报价不会进入支付。 */

export const UPGRADE_APPROVAL = 'pending_wecom' as const;

export function upgradeDifferenceYuan(oldAnnual: number, newAnnual: number, remainingDays: number): number {
    if (remainingDays <= 0) return 0;
    if (newAnnual <= oldAnnual) return 0;
    const raw = ((newAnnual - oldAnnual) * remainingDays) / 365;
    return Math.ceil(raw - 1e-9);
}

export function quoteUpgrade(oldAnnual: number, newAnnual: number, remainingDays: number) {
    return {
        amountYuan: upgradeDifferenceYuan(oldAnnual, newAnnual, remainingDays),
        approval: UPGRADE_APPROVAL,
        applied: false,
        note: '规则待企业微信确认后才会计入订单',
    };
}
