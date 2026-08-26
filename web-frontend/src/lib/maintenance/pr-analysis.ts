import { getHistoricalData } from '../api/nasa-power';
import { getAirQualityIndex } from '../api/open-meteo';
import { simpleChat } from '../ai/unified';
import { PRAnaInput, PRAnalysisReport } from './types';

/**
 * 性能比 (PR) 深度分析与异常诊断
 */
export async function analyzePR(input: PRAnaInput): Promise<PRAnalysisReport> {
    const { lat, lng, capacity, actualGeneration, startDate, endDate } = input;

    // 1. 获取 NASA POWER 历史气象数据
    // 获取起始年份和结束年份
    const startYear = parseInt(startDate.substring(0, 4));
    const endYear = parseInt(endDate.substring(0, 4));

    const nasaData = await getHistoricalData(lat, lng, startYear, endYear);
    const parameters = nasaData.properties.parameter;

    // 提取指定日期范围的数据
    const dates = Object.keys(parameters.ALLSKY_SFC_SW_DWN).filter(d => d >= startDate && d <= endDate);

    let totalGHI = 0;
    let totalTemp = 0;
    let dayCount = 0;

    // 物理常数
    const gamma = -0.004; // 晶硅组件温度系数
    const noct = 45; // 标称工作电池温度 (°C)
    const systemEfficiency = 0.85; // 假设系统效率 (线损、逆变器等，不含温度)

    let theoreticalGeneration = 0;

    dates.forEach(date => {
        const ghi = parameters.ALLSKY_SFC_SW_DWN[date] || 0; // kWh/m2/day
        const tamb = parameters.T2M[date] || 25; // 环境温度

        totalGHI += ghi;
        totalTemp += tamb;
        dayCount++;

        // 计算电池温度 Tcell = Tamb + (NOCT - 20) * (GHI / 0.8)
        // 注意：GHI 这里是日总量，我们需要瞬时强度来估算，
        // 简化处理：假设日照 10 小时，平均强度为 GHI/10 * 1000 W/m2
        // 或者直接按比例：Tcell = Tamb + (NOCT - 20) * (GHI / 8) 其中 8 是晴天参考日照
        const tCell = tamb + (noct - 20) * (ghi / 8);
        const tempCorr = 1 + gamma * (tCell - 25);

        // 每日理论发电量 = GHI * Capacity * 修正系数
        // 1 kWp 在 1 kWh/m2 下产生 1 kWh (STC)
        theoreticalGeneration += ghi * capacity * tempCorr * systemEfficiency;
    });

    const avgTemp = totalTemp / dayCount;
    const avgGHI = totalGHI / dayCount;
    const peakSunHours = totalGHI; // 总辐射量即为峰值日照时数累积

    // 2. 计算 PR
    const pr = actualGeneration / theoreticalGeneration;

    // 行业基准计算 (简单模型)
    // 新电站 80-85%，运行2.5年约 77-80%
    const yearsInService = 2.5; // 理想情况下从输入获取
    let benchmarkPr = 0.82;
    if (yearsInService > 1) benchmarkPr -= 0.015 * yearsInService;

    // 3. 获取空气质量 (估算积灰影响)
    let pm25 = 20;
    try {
        const aq = await getAirQualityIndex(lat, lng);
        pm25 = aq.pm25;
    } catch (e) {
        console.warn('AQI 获取失败', e);
    }

    // 4. 调用 AI 进行深度诊断
    const prompt = `
你是一个资深光伏运维专家。请根据以下电站数据进行性能比 (PR) 分析报告。

【基本信息】
位置坐标：${lat}, ${lng}
装机容量：${capacity} kWp
分析周期：${startDate} 至 ${endDate}
运行年限：${yearsInService} 年

【监控数据】
月总辐射量：${totalGHI.toFixed(1)} kWh/m²
月平均气温：${avgTemp.toFixed(1)} °C
平均PM2.5：${pm25} μg/m³
理论发电量：${theoreticalGeneration.toFixed(0)} kWh
实际发电量：${actualGeneration.toFixed(0)} kWh
实测性能比 (PR)：${(pr * 100).toFixed(1)}%
行业基准 PR：${(benchmarkPr * 100).toFixed(1)}%

请按照以下 JSON 格式输出深度分析报告，不要有任何多余文字：
{
  "diagnostics": [
    {
      "reason": "原因名称",
      "probability": 0.85, (0-1)
      "evidence": "诊断依据",
      "impact": "预估损失百分比",
      "verification": "验证方法",
      "action": "建议措施"
    }
  ],
  "economicLoss": {
    "monthlyLossGen": 1200, (kWh)
    "monthlyLossRevenue": 480, (元)
    "annualLossRevenue": 5760 (元)
  },
  "actionList": ["建议1", "建议2"]
}

注意：
- 如果 PR 远低于基准，优先排查积灰（结合PM2.5数据）、组件衰减、逆变器故障。
- 经济损失计算建议：电价取 0.4 元/kWh。
`;

    const aiDiagnosisRaw = await simpleChat(prompt);
    let aiDiagnosis;
    try {
        // 尝试清理可能的 Markdown 代码块包裹
        const jsonStr = aiDiagnosisRaw.replace(/```json|```/g, '').trim();
        aiDiagnosis = JSON.parse(jsonStr);
    } catch (e) {
        console.error('AI 诊断解析失败', e);
        // 兜底方案
        aiDiagnosis = {
            diagnostics: [],
            economicLoss: { monthlyLossGen: 0, monthlyLossRevenue: 0, annualLossRevenue: 0 },
            actionList: ["系统繁忙，请稍后再试"]
        };
    }

    return {
        stationInfo: {
            location: `维度:${lat}, 经度:${lng}`,
            capacity,
            period: `${startDate}-${endDate}`,
            yearsInService
        },
        meteoData: {
            totalRadiation: totalGHI,
            avgRadiation: avgGHI,
            avgTemp,
            peakSunHours
        },
        performance: {
            theoreticalGen: theoreticalGeneration,
            actualGen: actualGeneration,
            pr,
            benchmarkPr,
            deviation: pr - benchmarkPr,
            specificYield: actualGeneration / capacity,
            equivalentHours: actualGeneration / capacity
        },
        ...aiDiagnosis
    };
}
