
import {
    SohInput, SohResult,
    ThermalInput, ThermalResult,
    StorageConsistencyInput, StorageConsistencyResult
} from './types-advanced';

/**
 * 储能健康度（SOH）估算：只按循环次数做线性老化估计，同样的输入永远得到同样的结果。
 * 这是粗略估算，不是实测，也不构成保修或安全结论；原来混入了随机数和人为等待，已删除。
 */
export async function analyzeSOH(input: SohInput): Promise<SohResult> {
    const degradedSoh = 100 - (input.cycleCount * 0.005);
    const soh = Math.max(0, Math.min(100, degradedSoh));
    const agingRate = soh < 80 ? 'accelerated' : 'normal';

    return {
        soh: Number(soh.toFixed(2)),
        remainingCycles: Math.max(0, Math.floor((soh - 60) / 0.005)), // 估算到 60% SOH 还剩的循环数，不为负
        agingRate,
        // 只依据循环次数估算，不能据此断定「高温」「大电流」等具体原因
        factors: agingRate === 'accelerated'
            ? ['循环次数较多，老化偏快（仅按循环次数估算，需结合实测数据复核）']
            : ['日历老化与循环损耗（仅按循环次数估算）']
    };
}

export async function analyzeThermal(input: ThermalInput): Promise<ThermalResult> {
    await new Promise(resolve => setTimeout(resolve, 800));

    const maxTemp = Math.max(...input.temperatures);
    const minTemp = Math.min(...input.temperatures);
    const avgTemp = input.temperatures.reduce((a, b) => a + b, 0) / input.temperatures.length;

    const status = maxTemp > 60 ? 'critical' : maxTemp > 45 ? 'warning' : 'normal';
    const runawayRisk = maxTemp > 70 ? 90 : maxTemp > 60 ? 50 : 5;

    return {
        maxTemp,
        minTemp,
        avgTemp: Number(avgTemp.toFixed(1)),
        tempDiff: Number((maxTemp - minTemp).toFixed(1)),
        status,
        runawayRisk,
        coolingAction: status === 'critical'
            ? '立即启动强冷模式，停止充放电'
            : status === 'warning'
                ? '增加风扇转速，降低充放电功率'
                : '维持当前冷却策略'
    };
}

export async function analyzeConsistency(input: StorageConsistencyInput): Promise<StorageConsistencyResult> {
    await new Promise(resolve => setTimeout(resolve, 800));

    const maxV = Math.max(...input.cellVoltages);
    const minV = Math.min(...input.cellVoltages);
    const range = maxV - minV;

    const consistencyLevel = range < 0.01 ? 'A' : range < 0.03 ? 'B' : range < 0.05 ? 'C' : 'D';
    const abnormalCells = input.cellVoltages
        .map((v, i) => Math.abs(v - 3.2) > 0.1 ? i : -1) // Assuming 3.2V nominal
        .filter(i => i !== -1);

    return {
        consistencyLevel,
        voltageRange: Number(range.toFixed(3)),
        abnormalCells,
        balancingStatus: range > 0.02 ? 'needed' : 'not_needed',
        balancingTimeEstimate: range > 0.02 ? Math.ceil(range * 1000) : 0 // Rough estimate
    };
}
