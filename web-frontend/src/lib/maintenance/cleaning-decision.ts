import { getWeatherForecast, getAirQualityIndex } from '../api/open-meteo';
import { simpleChat } from '../ai/unified';
import { CleaningDecisionInput, CleaningDecision } from './types';

/**
 * 智能清洗决策系统
 */
export async function recommendCleaning(input: CleaningDecisionInput): Promise<CleaningDecision> {
    const { lat, lng, capacity, lastCleaningDate, tilt = 25, cleaningCostPerKw = 3 } = input;

    // 1. 获取近期空气质量和历史降雨
    // 注意：Open-Meteo 免费版获取历史降雨需要 archive API
    // 这里简化处理：获取当前 PM2.5 和 7 天预报（包含过去 2 天作为近似历史）
    const weather = await getWeatherForecast(lat, lng, 7);
    const aq = await getAirQualityIndex(lat, lng);

    const lastDate = new Date(lastCleaningDate);
    const today = new Date();
    const daysSinceLastCleaning = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    // 估算有效积灰天数 (扣除降雨天)
    // 简化逻辑：假设过去降雨频率与未来 7 天相似
    const rainDaysForecast = weather.daily.filter((d: { precipitation: number }) => d.precipitation > 0.5).length;
    const rainProb = rainDaysForecast / 7;
    const effectiveSoilingDays = Math.max(0, daysSinceLastCleaning * (1 - rainProb));

    // 灰尘损失模型
    // 日均积灰率: PM2.5 为 50 时约为 0.15%/天
    const avgSoilingRate = (aq.pm25 / 50) * 0.15;
    const estimatedLoss = Math.min(25, effectiveSoilingDays * avgSoilingRate);

    // 经济分析
    const currentDailyGen = (capacity * 4) * (1 - estimatedLoss / 100); // 假设 4 小时峰值日照
    const estimatedDailyGenAfterCleaning = capacity * 4;
    const dailyGain = estimatedDailyGenAfterCleaning - currentDailyGen;
    const monthlyGain = dailyGain * 30;
    const electricPrice = 0.4;
    const monthlyRevenueGain = monthlyGain * electricPrice;

    const cleaningCost = capacity * cleaningCostPerKw;
    const downtimeLoss = (capacity * 0.6) * 2 * electricPrice; // 停机 2 小时损失
    const totalCost = cleaningCost + downtimeLoss;

    // 2. 调用 AI 进行决策和天气分析
    const prompt = `
你是一个光伏运维专家。请根据以下积灰和经济数据，给出清洗决策建议。

【背景数据】
位置：${lat}, ${lng}
装机容量：${capacity} kWp
上次清洗：${lastCleaningDate}（${daysSinceLastCleaning} 天前）
估算灰尘损失：${estimatedLoss.toFixed(1)}%
当前PM2.5：${aq.pm25} μg/m³
清洗成本：¥${totalCost.toFixed(0)}
月度增收潜力：¥${monthlyRevenueGain.toFixed(0)}

【天气预报 (未来7天)】
${weather.daily.map((d: { date: string; precipitation: number }) => `${d.date}: ${d.precipitation > 0 ? '有雨(' + d.precipitation + 'mm)' : '晴'}`).join('\n')}

请返回 JSON 格式的推荐报告：
{
  "recommendation": {
    "shouldClean": true/false,
    "reason": "推荐理由",
    "bestWindow": {
      "date": "YYYY-MM-DD",
      "time": "06:00-09:00",
      "weather": "天气描述",
      "temp": "温度"
    },
    "avoidDates": ["日期1"]
  },
  "proTips": ["专业建议1", "专业建议2"]
}
`;

    const aiResRaw = await simpleChat(prompt);
    let aiRes: Partial<CleaningDecision>;
    try {
        const jsonStr = aiResRaw.replace(/```json|```/g, '').trim();
        aiRes = JSON.parse(jsonStr);
    } catch (e) {
        aiRes = {
            recommendation: {
                shouldClean: estimatedLoss > 5,
                reason: "建议根据实际情况清洗",
                bestWindow: { date: '', time: '', weather: '', temp: '' },
                avoidDates: []
            },
            proTips: ["清洗方向从上到下", "使用去离子水"]
        };
    }

    return {
        soilingAssessment: {
            lastCleaningDays: daysSinceLastCleaning,
            effectiveSoilingDays,
            avgPm25: aq.pm25,
            tilt,
            estimatedLoss
        },
        economicAnalysis: {
            currentDailyGen,
            estimatedDailyGenAfterCleaning,
            dailyGain,
            monthlyGain,
            monthlyRevenueGain,
            cleaningCost,
            downtimeLoss,
            totalCost
        },
        recommendation: aiRes.recommendation || {
            shouldClean: estimatedLoss > 5,
            reason: "建议根据实际情况清洗",
            bestWindow: { date: '', time: '', weather: '', temp: '' },
            avoidDates: []
        },
        proTips: aiRes.proTips || ["清洗方向从上到下", "使用去离子水"]
    };
}
