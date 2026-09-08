/** 年末现金流简化模型：初始投资仅在第 0 年计入。金额均为元。 */
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
    const discountedCosts = initialInvestment + cashFlow.reduce((sum, row) => sum + row.cost / (1 + discountRate) ** row.year, 0);
    const discountedGeneration = cashFlow.reduce((sum, row) => sum + row.generation / (1 + discountRate) ** row.year, 0);
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
        npv, irr, lcoe: discountedCosts / discountedGeneration, paybackPeriod, cashFlow,
    };
    if ([result.npv, result.lcoe, result.totalGeneration, result.totalRevenue, ...cashFlow.flatMap(row => Object.values(row))].some(value => !Number.isFinite(value))) {
        throw new Error('FINANCE_OVERFLOW');
    }
    return result;
}
