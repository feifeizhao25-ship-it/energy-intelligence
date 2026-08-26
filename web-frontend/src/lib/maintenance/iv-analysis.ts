import { simpleChat } from '../ai/unified';
import { IVAnalysisInput, IVAnalysis } from './types';

/**
 * IV 曲线分析指导
 */
export async function analyzeIVCurve(input: IVAnalysisInput): Promise<IVAnalysis> {
    const {
        voc_nom, isc_nom, vmp_nom, imp_nom, pmax_nom,
        voc_meas, isc_meas, vmp_meas, imp_meas, pmax_meas,
        irradiance, temperature, moduleModel = '标准单晶'
    } = input;

    // 1. 计算填充因子 FF
    const ff_nom = (vmp_nom * imp_nom) / (voc_nom * isc_nom);
    const ff_meas = (vmp_meas * imp_meas) / (voc_meas * isc_meas);

    // 2. 调用 AI 进行形态分析
    const prompt = `
你是一个光伏组件实验室专家。请针对以下 IV 曲线测量数据进行专业深度分析。

【组件信息】
型号：${moduleModel}
额定参数 (STC)：Voc=${voc_nom}V, Isc=${isc_nom}A, Pmax=${pmax_nom}W, FF=${(ff_nom * 100).toFixed(1)}%

【实测数据】
测试环境：辐射 ${irradiance} W/m², 温度 ${temperature} °C
实测参数：Voc=${voc_meas}V, Isc=${isc_meas}A, Pmax=${pmax_meas}W, FF=${(ff_meas * 100).toFixed(1)}%

请根据曲线参数偏差，分析组件健康状况。
注意：
- FF 下降通常意味着串联电阻 Rs 增大或并联电阻 Rsh 减小。
- Isc 下降主要与辐照和积灰有关。
- Voc 下降与温度和电池片损伤有关。

请返回 JSON 格式分析报告：
{
  "morphologyAnalysis": "曲线形态描述",
  "diagnosis": {
    "conclusion": "诊断结论",
    "detailedAnalysis": ["深度分析点1", "深度分析点2"],
    "reasons": ["可能原因1", "原因2"]
  },
  "economicDecision": {
    "action": "处理建议",
    "reasoning": "建议理由",
    "recoveryEstimate": "预估恢复效果"
  }
}
`;

    const aiResRaw = await simpleChat(prompt);
    let aiRes;
    try {
        const jsonStr = aiResRaw.replace(/```json|```/g, '').trim();
        aiRes = JSON.parse(jsonStr);
    } catch (e) {
        aiRes = {
            morphologyAnalysis: "测量数据已记录",
            diagnosis: { conclusion: "数据异常，需人工复核", detailedAnalysis: [], reasons: [] },
            economicDecision: { action: "现场排查", reasoning: "FF 偏低", recoveryEstimate: "未知" }
        };
    }

    const comparison = [
        { param: 'Voc', nominal: voc_nom, measured: voc_meas, deviation: (voc_meas - voc_nom) / voc_nom },
        { param: 'Isc', nominal: isc_nom, measured: isc_meas, deviation: (isc_meas - isc_nom) / isc_nom },
        { param: 'Pmax', nominal: pmax_nom, measured: pmax_meas, deviation: (pmax_meas - pmax_nom) / pmax_nom },
    ];

    return {
        condition: {
            timestamp: new Date().toISOString(),
            irradiance,
            temperature,
            model: moduleModel
        },
        comparison,
        ff: {
            nominal: ff_nom,
            measured: ff_meas,
            deviation: (ff_meas - ff_nom) / ff_nom
        },
        ...aiRes
    };
}
