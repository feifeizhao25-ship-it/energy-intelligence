import { StringAnalysisInput, StringAnalysis } from './types';

/**
 * 组串级异常定位
 */
export async function analyzeStrings(input: StringAnalysisInput): Promise<StringAnalysis> {
    const { invName, strings } = input;

    if (strings.length === 0) {
        throw new Error('未提供组串数据');
    }

    // 1. 计算平均值和标准差
    const powers = strings.map(s => s.power);
    const avgPower = powers.reduce((a, b) => a + b, 0) / strings.length;
    const stdDev = Math.sqrt(powers.map(p => Math.pow(p - avgPower, 2)).reduce((a, b) => a + b, 0) / strings.length);

    // 2. 诊断逻辑
    const stringResults = strings.map(s => {
        const deviation = (s.power - avgPower) / avgPower;
        let status: 'normal' | 'error' | 'warning' = 'normal';

        if (deviation < -0.15) status = 'error';
        else if (deviation < -0.05) status = 'warning';

        return {
            id: s.id,
            v: s.voltage,
            a: s.current,
            w: s.power,
            status
        };
    });

    const diagnostics: any[] = [];
    let dailyLossWatts = 0;

    stringResults.filter(r => r.status !== 'normal').forEach(r => {
        const original = strings.find(s => s.id === r.id)!;
        const vDev = (r.v - (strings.reduce((a, b) => a + b.voltage, 0) / strings.length)) / (strings.reduce((a, b) => a + b.voltage, 0) / strings.length);
        const aDev = (r.a - (strings.reduce((a, b) => a + b.current, 0) / strings.length)) / (strings.reduce((a, b) => a + b.current, 0) / strings.length);

        const loss = avgPower - r.w;
        dailyLossWatts += loss;

        let type = "未知异常";
        let reasons: string[] = [];
        let actions: string[] = [];

        if (Math.abs(vDev) < 0.03 && aDev < -0.1) {
            type = "组件遮挡或污染";
            reasons = ["局部阴影遮挡", "严重灰尘堆积", "草木生长遮挡"];
            actions = ["现场检查是否有阴影", "安排组件清洗", "清理周边植被"];
        } else if (vDev < -0.1 && Math.abs(aDev) < 0.05) {
            type = "部分组件失效";
            reasons = ["旁路二极管短路", "1-2块组件开路", "接头严重松动"];
            actions = ["测量各组件开路电压", "检查 MC4 接头是否发热"];
        } else if (vDev < -0.05 && aDev < -0.05) {
            type = "综合性故障";
            reasons = ["组件隐裂", "PID效应", "多点故障汇集"];
            actions = ["进行红外热成像检测", "进行 EL 抽检"];
        }

        diagnostics.push({
            stringId: r.id,
            severity: r.status === 'error' ? 'high' : 'medium',
            type,
            reasons,
            actions
        });
    });

    const dailyLossKwh = (dailyLossWatts / 1000) * 5; // 假设 5 小时有效时长
    const monthlyLossRevenue = dailyLossKwh * 30 * 0.4;

    return {
        summary: {
            invName,
            timestamp: new Date().toISOString(),
            avgPower,
            stdDev
        },
        stringResults,
        diagnostics,
        lossEstimate: {
            dailyLossWatts,
            dailyLossKwh,
            monthlyLossRevenue
        }
    };
}
