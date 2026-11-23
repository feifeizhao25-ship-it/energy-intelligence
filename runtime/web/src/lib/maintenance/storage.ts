
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

    const maxTemp = Math.max(...input.temperatures);
    const minTemp = Math.min(...input.temperatures);
    const avgTemp = input.temperatures.reduce((a, b) => a + b, 0) / input.temperatures.length;

    // 核9：45 / 60 °C 是示例阈值，没有标准出处；处置以电池厂家规格书、BMS 设定和电站储能运维规程为准。
    // 不再给「热失控风险 90%」这类没有依据的百分比，也不替用户下「停止充放电」的操作指令。
    const status = maxTemp > 60 ? 'critical' : maxTemp > 45 ? 'warning' : 'normal';

    return {
        maxTemp,
        minTemp,
        avgTemp: Number(avgTemp.toFixed(1)),
        tempDiff: Number((maxTemp - minTemp).toFixed(1)),
        status,
        runawayRisk: null,
        coolingAction: status === 'critical'
            ? '温度高于示例阈值 60 °C：请按电站储能运维规程和电池厂家手册处置，并立即通知运维负责人'
            : status === 'warning'
                ? '温度高于示例阈值 45 °C：请对照厂家规格书检查冷却系统和充放电功率'
                : '未超过示例阈值',
        thresholdNote: '45 °C / 60 °C 为示例阈值，没有标准出处；请以电池厂家规格书和 BMS 设定的告警值为准。',
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
