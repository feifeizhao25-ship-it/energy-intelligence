import { StorageCalculationInput } from '@/types';

export interface StorageFinancialResult {
    dailyRevenue: number;
    annualRevenue: number;
    paybackYears: number;
    irr: number;
    npv: number;
    lcos: number; // Levelized Cost of Storage
}

export async function calculateStorage(input: StorageCalculationInput) {
    const years = 10; // 储能系统通常按10年评估

    // 1. 发电/放电模型
    const usableEnergy = input.energy * (input.technical.dod / 100);
    const cycleLossCorrection = Math.sqrt(input.technical.efficiency / 100); // 单程效率

    let dailyRevenue = 0;

    if (input.applicationMode === 'arbitrage' && input.arbitrageConfig) {
        const { peakPrice, valleyPrice, flatPrice } = input.arbitrageConfig;
        // 典型的“两充两放”模式
        const cycle1Revenue = usableEnergy * (peakPrice - valleyPrice * (1 / (input.technical.efficiency / 100)));
        const cycle2Revenue = input.arbitrageConfig.chargeTime2 ?
            usableEnergy * (peakPrice - flatPrice * (1 / (input.technical.efficiency / 100))) : 0;

        dailyRevenue = cycle1Revenue + cycle2Revenue;
    }

    if (input.applicationMode === 'demand_management' && input.demandConfig) {
        // 需量管理收益 = 减少的需量 * 需量电费
        const monthlyDemandSaving = input.demandConfig.peakReduction * input.demandConfig.demandCharge;
        dailyRevenue += (monthlyDemandSaving * 12) / 365;
    }

    // 2. 财务模拟
    const totalInvestment = input.investment.totalInvestment ?? input.energy * input.investment.unitCost;
    const annualOM = totalInvestment * (input.technical.maintenanceCostRatio / 100);
    const discountRate = 0.08;

    const cashFlows: number[] = [-totalInvestment];
    const annualGenerations: number[] = [];

    for (let year = 1; year <= years; year++) {
        const degradation = Math.pow(1 - input.technical.degradationRate / 100, year - 1);
        const yearRevenue = dailyRevenue * 330 * degradation; // 假设由于检修等每年运行330天
        const netCash = yearRevenue - annualOM;
        cashFlows.push(netCash);
        annualGenerations.push(usableEnergy * 2 * 330 * degradation); // 每年放电量
    }

    // 内部收益率
    const irr = calculateIRR(cashFlows);

    // LCOS 计算: (总投资 + 总运维) / 总放电量
    const totalDischarge = annualGenerations.reduce((a, b) => a + b, 0);
    const totalCost = totalInvestment + annualOM * years;
    const lcos = totalCost / totalDischarge;

    return {
        technical: {
            usableEnergy,
            dailyCycles: input.arbitrageConfig?.chargeTime2 ? 2 : 1,
            estimatedLifeDays: input.technical.cycleLife / (input.arbitrageConfig?.chargeTime2 ? 2 : 1)
        },
        financial: {
            metrics: {
                dailyRevenue,
                annualRevenue: dailyRevenue * 330,
                irr: irr * 100,
                lcos,
                paybackYears: calculatePaybackPeriod(totalInvestment, cashFlows.slice(1)),
                npv: cashFlows.reduce((sum, val, t) => sum + val / Math.pow(1 + discountRate, t), 0)
            },
            investment: {
                total: totalInvestment,
                unitCost: input.investment.unitCost
            }
        }
    };
}

function calculateIRR(cashFlows: number[]): number {
    let irr = 0.1;
    for (let i = 0; i < 100; i++) {
        let npv = 0;
        let dnpv = 0;
        for (let t = 0; t < cashFlows.length; t++) {
            npv += cashFlows[t] / Math.pow(1 + irr, t);
            dnpv -= t * cashFlows[t] / Math.pow(1 + irr, t + 1);
        }
        const newIrr = irr - npv / dnpv;
        if (Math.abs(newIrr - irr) < 0.0001) return newIrr;
        irr = newIrr;
    }
    return irr;
}

function calculatePaybackPeriod(initialInvestment: number, annualCashFlows: number[]): number {
    let remaining = initialInvestment;
    for (let year = 0; year < annualCashFlows.length; year++) {
        remaining -= annualCashFlows[year];
        if (remaining <= 0) {
            return year + 1 + remaining / annualCashFlows[year];
        }
    }
    return 10;
}
