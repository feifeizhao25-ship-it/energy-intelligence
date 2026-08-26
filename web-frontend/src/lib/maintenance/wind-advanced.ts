
import { VibrationInput, VibrationResult, BladeDroneInput, BladeDroneResult } from './types-advanced';

export async function analyzeVibration(input: VibrationInput): Promise<VibrationResult> {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock logic based on input
    const isCritical = Math.random() < 0.2;
    const isWarning = !isCritical && Math.random() < 0.3;
    const status = isCritical ? 'critical' : isWarning ? 'warning' : 'normal';

    return {
        status,
        dominantFrequencies: [
            { freq: input.rpm / 60, amplitude: 0.5, source: '1X RPM (Unbalance)' },
            { freq: (input.rpm / 60) * 3, amplitude: isCritical ? 2.5 : 0.2, source: '3X RPM (Misalignment)' }
        ],
        diagnosis: isCritical
            ? '检测到严重不对中信号，建议立即停机检查'
            : isWarning
                ? '存在轻微不平衡，建议在下次维护时关注'
                : '设备运行平稳，振动频谱正常',
        maintenanceAction: isCritical
            ? '立即停机，检查联轴器对中情况'
            : isWarning
                ? '缩短巡检周期，监控振动趋势'
                : '按照标准周期维护'
    };
}

export async function analyzeBladeImage(input: BladeDroneInput): Promise<BladeDroneResult> {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const damageCount = Math.floor(Math.random() * 3);
    const damages = [];

    for (let i = 0; i < damageCount; i++) {
        damages.push({
            type: Math.random() > 0.5 ? 'erosion' : 'crack',
            location: `距离根部 ${Math.floor(Math.random() * 40 + 5)}米`,
            severity: Math.floor(Math.random() * 5) + 1,
            size: `${Math.floor(Math.random() * 10 + 1)}cm`
        });
    }

    const maxSeverity = Math.max(...damages.map(d => d.severity), 0);
    const riskLevel = maxSeverity >= 4 ? 'high' : maxSeverity >= 2 ? 'medium' : 'low';

    return {
        bladeId: input.bladeId || 'Blade-A',
        damages: damages as any[],
        riskLevel,
        repairPlan: riskLevel === 'high'
            ? '建议立即安排吊篮维修或叶片更换'
            : riskLevel === 'medium'
                ? '建议在3个月内进行打磨修复'
                : '继续监控，无需立即处理'
    };
}
