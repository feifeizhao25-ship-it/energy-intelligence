import { StorageCalculationInput } from '@/types';
import { solveIrr } from './project-finance';

export interface StorageFinancialResult {
    dailyRevenue: number;
    annualRevenue: number;
    paybackYears: number;
    irr: number | null; // 无唯一解时为 null
    npv: number;
    lcos: number; // Levelized Cost of Storage
}

export async function calculateStorage(input: StorageCalculationInput) {
    const years = 10; // 储能系统通常按10年评估

    // 1. 发电/放电模型
    const usableEnergy = input.energy * (input.technical.dod / 100);
    // 每日循环次数取自配置：只有配置了第二段充电时段才按两充两放；否则一充一放
    const dailyCycles = input.applicationMode === 'arbitrage' && input.arbitrageConfig?.chargeTime2 ? 2 : 1;
    const operatingDays = input.technical.operatingDaysPerYear ?? 330;
    // 单程效率 = √往返效率；放电量按电池侧可用能量 × 单程效率计到电网侧
    const oneWayEfficiency = Math.sqrt(input.technical.efficiency / 100);
    const calendarFadePerYear = (input.technical.calendarDegradationRate ?? 0) / 100;

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
        // 容量衰减 = 循环衰减（degradationRate，%/年）× 日历衰减（calendarDegradationRate，%/年，默认 0）
        const degradation = Math.pow(1 - input.technical.degradationRate / 100, year - 1)
            * Math.pow(1 - calendarFadePerYear, year - 1);
        const yearRevenue = dailyRevenue * operatingDays * degradation;
        const netCash = yearRevenue - annualOM;
        cashFlows.push(netCash);
        annualGenerations.push(usableEnergy * oneWayEfficiency * dailyCycles * operatingDays * degradation); // 每年放电量（电网侧）
    }

    // 内部收益率：唯一解才给数，否则 null
    const irrFraction = solveIrr(cashFlows);

    // LCOS 计算: (总投资 + 总运维) / 总放电量
    const totalDischarge = annualGenerations.reduce((a, b) => a + b, 0);
    const totalCost = totalInvestment + annualOM * years;
    const lcos = totalCost / totalDischarge;

    return {
        technical: {
            usableEnergy,
            dailyCycles,
            operatingDays,
            estimatedLifeDays: input.technical.cycleLife / dailyCycles
        },
        assumptions: [
            `每日循环 ${dailyCycles} 次（${dailyCycles === 2 ? '已配置第二段充放电时段' : '未配置第二段充电时段'}）`,
            `年运行天数 ${operatingDays} 天`,
            `循环衰减 ${input.technical.degradationRate}%/年，日历衰减 ${(calendarFadePerYear * 100).toFixed(1)}%/年`,
            `单程效率 ${(oneWayEfficiency * 100).toFixed(1)}%（往返效率 ${input.technical.efficiency}% 的平方根）`,
        ],
        financial: {
            metrics: {
                dailyRevenue,
                annualRevenue: dailyRevenue * operatingDays,
                irr: irrFraction === null ? null : irrFraction * 100,
                lcos,
                paybackYears: calculatePaybackPeriod(totalInvestment, cashFlows.slice(1)),
                npv: cashFlows.reduce((sum, val, t) => sum + val / Math.pow(1 + discountRate, t), 0)
            },
            investment: {
                total: totalInvestment,
                unitCost: input.investment.unitCost
            },
            /** 逐年现金流，cashFlows[0] 为第 0 年（负的初始投资），第 1–10 年为净收入 */
            cashFlows
        }
    };
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
