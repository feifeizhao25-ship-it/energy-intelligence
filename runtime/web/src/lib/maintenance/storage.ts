
import {
    SohInput, SohResult,
    ThermalInput, ThermalResult,
    StorageConsistencyInput, StorageConsistencyResult
} from './types-advanced';

export async function analyzeSOH(input: SohInput): Promise<SohResult> {
    await new Promise(resolve => setTimeout(resolve, 800));

    // Simple degradation model
    const degradedSoh = 100 - (input.cycleCount * 0.005) - (Math.random() * 2);
    const soh = Math.max(0, Math.min(100, degradedSoh));
    const agingRate = soh < 80 ? 'accelerated' : 'normal';

    return {
        soh: Number(soh.toFixed(2)),
        remainingCycles: Math.floor((soh - 60) / 0.005), // Cycles until 60% SOH
        agingRate,
        factors: agingRate === 'accelerated'
            ? ['高温操作', '大电流充放电']
            : ['正常日历老化', '循环损耗']
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
