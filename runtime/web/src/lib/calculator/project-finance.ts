/**
 * 财务求解器（NPV、IRR、折现 LCOE、回收期），供统一光伏模型 lib/calculator/solar.ts 与风电、方案对比共用。
 * 年末现金流：初始投资仅在第 0 年计入。金额均为元。
 * 原来这里还有一个 projectFinance（固定综合效率 0.8 的 v2 光伏专用财务模型），v2 已改为调用统一光伏模型，已删除。
 */

/** 全站统一的默认折现率（8%），NPV 与 LCOE 共用。 */
export const DEFAULT_DISCOUNT_RATE = 0.08;

/** 现金流按年末折现求净现值。cashFlows[0] 为第 0 年（通常是负的初始投资）。 */
export function npvOf(cashFlows: readonly number[], rate: number): number {
    return cashFlows.reduce((sum, value, t) => sum + value / (1 + rate) ** t, 0);
}

/**
 * 内部收益率（小数，例如 0.08 表示 8%）。cashFlows[0] 为第 0 年。
 * 只有现金流符号恰好变化一次时才有唯一解（笛卡尔符号法则）；无解或多解返回 null，不伪造数值。
 * 用二分法求解，不会像牛顿法那样在导数接近 0 时发散。
 */
export function solveIrr(cashFlows: readonly number[]): number | null {
    if (cashFlows.length < 2 || cashFlows.some(v => !Number.isFinite(v))) return null;
    const signs = cashFlows.filter(v => v !== 0).map(v => Math.sign(v));
    let changes = 0;
    for (let i = 1; i < signs.length; i++) if (signs[i] !== signs[i - 1]) changes++;
    if (changes !== 1) return null;
    const f = (rate: number) => npvOf(cashFlows, rate);
    let low = -0.999;
    let high = 1;
    // f 在 (-1, ∞) 上单调（唯一一次变号），先把上界扩到与下界异号
    while (Math.sign(f(high)) === Math.sign(f(low)) && high < 1e6) high *= 2;
    if (Math.sign(f(high)) === Math.sign(f(low))) return null;
    const lowSign = Math.sign(f(low));
    for (let i = 0; i < 200; i++) {
        const mid = (low + high) / 2;
        if (Math.sign(f(mid)) === lowSign) low = mid; else high = mid;
    }
    return (low + high) / 2;
}

/**
 * 平准化度电成本（口径库 STANDARDS.LCOE）：
 *   LCOE = [I0 + Σ Cost_t/(1+r)^t] / Σ [E_t/(1+r)^t]，t = 1..n，年末折现。
 * annualCosts[i] / annualGeneration[i] 对应第 i+1 年。
 */
export function discountedLcoe(input: {
    initialInvestment: number;
    annualCosts: readonly number[];
    annualGeneration: readonly number[];
    discountRate: number;
}): number {
    const { initialInvestment, annualCosts, annualGeneration, discountRate } = input;
    if (annualCosts.length !== annualGeneration.length || annualGeneration.length === 0) throw new Error('INVALID_LCOE_INPUT');
    const costs = initialInvestment + annualCosts.reduce((sum, c, i) => sum + c / (1 + discountRate) ** (i + 1), 0);
    const energy = annualGeneration.reduce((sum, e, i) => sum + e / (1 + discountRate) ** (i + 1), 0);
    if (!(energy > 0)) throw new Error('INVALID_LCOE_INPUT');
    return costs / energy;
}

/** 静态回收期（年，线性插值）。寿命期内未回本返回 null。annualNetCashFlows[i] 为第 i+1 年。 */
export interface TaxFlags {
    增值税: '未计' | string;
    所得税优惠: '未计' | string;
}

/** 税费默认未计，并说明简化度电成本与含税口径的差别。 */
export function taxAssumptions(vat?: string, incomeTax?: string): TaxFlags & { 口径: string; 含税差别: string } {
    const counted = Boolean(vat || incomeTax);
    return {
        增值税: vat || '未计',
        所得税优惠: incomeTax || '未计',
        口径: 'NREL 简化平准化度电成本',
        含税差别: counted ? '税额进入分子后，度电成本上升' : '未计',
    };
}

export function paybackPeriodOf(initialInvestment: number, annualNetCashFlows: readonly number[]): number | null {
    let remaining = initialInvestment;
    for (let i = 0; i < annualNetCashFlows.length; i++) {
        const cf = annualNetCashFlows[i];
        if (remaining > 0 && cf > 0 && cf >= remaining) return i + remaining / cf;
        remaining -= cf;
    }
    return remaining <= 0 ? 0 : null;
}
