/** 年末现金流简化模型：初始投资仅在第 0 年计入。金额均为元。 */

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
export function paybackPeriodOf(initialInvestment: number, annualNetCashFlows: readonly number[]): number | null {
    let remaining = initialInvestment;
    for (let i = 0; i < annualNetCashFlows.length; i++) {
        const cf = annualNetCashFlows[i];
        if (remaining > 0 && cf > 0 && cf >= remaining) return i + remaining / cf;
        remaining -= cf;
    }
    return remaining <= 0 ? 0 : null;
}

export interface FinanceInput {
    initialInvestment: number;
    annualGeneration: number;
    electricityPrice: number;
    annualOperatingCost: number;
    lifetime: number;
    degradationRate: number;
    discountRate: number;
}

export function projectFinance(input: FinanceInput) {
    for (const value of Object.values(input)) {
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('INVALID_FINANCE_INPUT');
    }
    const { initialInvestment, annualGeneration, electricityPrice, annualOperatingCost, lifetime, degradationRate, discountRate } = input;
    if (initialInvestment <= 0 || annualGeneration <= 0 || electricityPrice < 0 || annualOperatingCost < 0
        || !Number.isInteger(lifetime) || lifetime < 1 || lifetime > 100
        || degradationRate < 0 || degradationRate >= 1 || discountRate < 0 || discountRate > 1) throw new Error('INVALID_FINANCE_INPUT');
    const cashFlow = Array.from({ length: lifetime }, (_, index) => {
        const year = index + 1;
        const generation = annualGeneration * (1 - degradationRate) ** index;
        const revenue = generation * electricityPrice;
        return { year, generation, revenue, cost: annualOperatingCost, netCashFlow: revenue - annualOperatingCost };
    });
    const npvAt = (rate: number) => -initialInvestment + cashFlow.reduce((sum, row) => sum + row.netCashFlow / (1 + rate) ** row.year, 0);
    const npv = npvAt(discountRate);
    const lcoe = discountedLcoe({
        initialInvestment,
        annualCosts: cashFlow.map(row => row.cost),
        annualGeneration: cashFlow.map(row => row.generation),
        discountRate,
    });
    // 仅对单次符号变化的传统现金流求唯一 IRR；无根或多重根不伪造数值。
    let irr: number | null = null;
    if (cashFlow.every(row => row.netCashFlow >= 0) && cashFlow.some(row => row.netCashFlow > 0)) {
        let low = -0.999;
        let high = 1;
        while (npvAt(high) > 0 && high < 1e6) high *= 2;
        if (npvAt(low) > 0 && npvAt(high) <= 0) {
            for (let i = 0; i < 200; i++) {
                const mid = (low + high) / 2;
                if (npvAt(mid) > 0) low = mid; else high = mid;
            }
            irr = ((low + high) / 2) * 100;
        }
    }
    let remaining = initialInvestment;
    let paybackPeriod: number | null = null;
    for (const row of cashFlow) {
        if (remaining > 0 && row.netCashFlow >= remaining) {
            paybackPeriod = row.year - 1 + remaining / row.netCashFlow;
            break;
        }
        remaining -= row.netCashFlow;
    }
    const result = {
        initialInvestment, annualGeneration,
        totalGeneration: cashFlow.reduce((sum, row) => sum + row.generation, 0),
        totalRevenue: cashFlow.reduce((sum, row) => sum + row.revenue, 0),
        npv, irr, lcoe, paybackPeriod, cashFlow,
    };
    if ([result.npv, result.lcoe, result.totalGeneration, result.totalRevenue, ...cashFlow.flatMap(row => Object.values(row))].some(value => !Number.isFinite(value))) {
        throw new Error('FINANCE_OVERFLOW');
    }
    return result;
}
