/** 标准档试用。不创建支付请求。同一手机号只能开始一次。 */

const DAY = 86_400_000;

export interface TrialClaim {
    phoneHash: string;
    startedAt: string;
    endsAt: string;
}

export function hashPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    let hash = 2166136261;
    for (let index = 0; index < digits.length; index += 1) {
        hash ^= digits.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
}

export function startTrial(claims: TrialClaim[], phone: string, now: Date): { ok: true; claim: TrialClaim; payment: null } | { ok: false; reason: string } {
    const phoneHash = hashPhone(phone);
    if (!phoneHash || phone.replace(/\D/g, '').length < 11) return { ok: false, reason: '手机号无效' };
    if (claims.some((claim) => claim.phoneHash === phoneHash)) return { ok: false, reason: '该手机号已经使用过试用' };
    const claim = {
        phoneHash,
        startedAt: now.toISOString(),
        endsAt: new Date(now.getTime() + 7 * DAY).toISOString(),
    };
    return { ok: true, claim, payment: null };
}

export function planAfterTrial(claim: TrialClaim | null, now: Date, paidPlan: string): string {
    if (!claim) return paidPlan;
    if (now.getTime() >= new Date(claim.endsAt).getTime()) return 'FREE';
    return 'PRO';
}

export function trialWatermark(onTrial: boolean): '试用' | null {
    return onTrial ? '试用' : null;
}

/** 经营许可未取得时，收费入口关闭，试用仍可开始。 */
export function paidCheckoutOpen(licenseGranted: boolean): boolean {
    return licenseGranted;
}
