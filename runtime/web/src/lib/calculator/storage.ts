import { StorageCalculationInput } from '@/types';
import { solveIrr } from './project-finance';
import { proportionalRange, irrRange, levelizedCostRange, STORAGE_THROUGHPUT_REL_UNCERTAINTY, STORAGE_RANGE_NOTE } from './ranges';

export interface StorageFinancialResult {
    dailyRevenue: number;
    annualRevenue: number;
    paybackYears: number | null; // 评估期内未回本时为 null（原来返回 10，界面显示“10 年”）
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
        ranges: {
            annualRevenue: proportionalRange(dailyRevenue * operatingDays, STORAGE_THROUGHPUT_REL_UNCERTAINTY, STORAGE_RANGE_NOTE),
            irr: irrRange(
                totalInvestment, cashFlows.slice(1).map(c => c + annualOM), cashFlows.slice(1).map(() => annualOM),
                irrFraction === null ? null : irrFraction * 100, STORAGE_THROUGHPUT_REL_UNCERTAINTY, STORAGE_RANGE_NOTE,
            ),
            lcos: levelizedCostRange(lcos, STORAGE_THROUGHPUT_REL_UNCERTAINTY, STORAGE_RANGE_NOTE),
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

/** Schmidt 等（2019，Joule）口径的简化 LCOS：折现后的投资、运维与充电成本，除以折现放电量。 */
export function schmidtLcos(input: {
    capex: number;
    annualOm: number;
    annualChargeCost: number;
    annualDischargeKwh: number;
    years: number;
    discountRate?: number;
}): number {
    const rate = input.discountRate ?? 0.08;
    let numerator = input.capex;
    let denominator = 0;
    for (let year = 1; year <= input.years; year++) {
        const factor = (1 + rate) ** year;
        numerator += (input.annualOm + input.annualChargeCost) / factor;
        denominator += input.annualDischargeKwh / factor;
    }
    if (!(denominator > 0)) throw new Error('放电量为 0，无法计算储能度电成本');
    return numerator / denominator;
}

/** 两段谷段充电、两段峰段放电。未给出第二段时只排一充一放。 */
export function scheduleTwoWindows(input: {
    usableKwh: number;
    roundTripEfficiency: number;
    windows: { charge: string; discharge: string }[];
}): { cycles: number; dischargeKwh: number; note: string } {
    const cycles = Math.min(2, input.windows.length);
    const oneWay = Math.sqrt(input.roundTripEfficiency);
    return {
        cycles,
        dischargeKwh: input.usableKwh * oneWay * cycles,
        note: cycles === 2 ? '按两段分时窗口各充放一次' : '只配置了一段分时窗口',
    };
}

function calculatePaybackPeriod(initialInvestment: number, annualCashFlows: number[]): number | null {
    let remaining = initialInvestment;
    for (let year = 0; year < annualCashFlows.length; year++) {
        remaining -= annualCashFlows[year];
        if (remaining <= 0) {
            return year + 1 + remaining / annualCashFlows[year];
        }
    }
    return null;
}
