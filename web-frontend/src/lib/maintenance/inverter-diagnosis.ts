import { simpleChat } from '../ai/unified';
import { InverterDiagnosisInput, InverterDiagnosis } from './types';

/**
 * 逆变器故障智能诊断
 */
export async function diagnoseInverter(input: InverterDiagnosisInput): Promise<InverterDiagnosis> {
    const { brand = '通用', model = '未知', errorCode, symptoms } = input;

    const prompt = `
你是一个资深的逆变器技术专家，精通华为、阳光电源、锦浪、固德威等主流品牌。
请针对以下故障进行专业诊断。

【设备信息】
品牌：${brand}
型号：${model}
故障代码：${errorCode || '无'}
故障现象：${symptoms || '未提供'}

请返回专业的诊断报告 (JSON 格式):
{
  "deviceInfo": {
    "brand": "${brand}",
    "model": "${model}",
    "errorCode": "${errorCode}",
    "description": "故障简述"
  },
  "analysis": {
    "primaryReason": {
      "reason": "首要原因",
      "probability": 0.8,
      "evidence": "依据",
      "danger": "危害描述"
    },
    "secondaryReasons": [
      { "reason": "次要原因", "probability": 0.1, "symptoms": "症状表现" }
    ]
  },
  "safetyWarning": ["安全警告1", "安全警告2"],
  "repairSteps": [
    { "step": "步骤名称", "description": "操作细节", "order": 1 }
  ],
  "prevention": ["预防措施1"],
  "references": ["参考标准或文献"]
}

注意：如果提供了故障代码（如华为的 2001），请优先准确解释该代码。如果只有现象，请进行模式识别。
`;

    const aiResRaw = await simpleChat(prompt);
    let aiRes;
    try {
        const jsonStr = aiResRaw.replace(/```json|```/g, '').trim();
        aiRes = JSON.parse(jsonStr);
    } catch (e) {
        aiRes = {
            deviceInfo: { brand, model, errorCode: errorCode || '', description: "诊断失败" },
            analysis: { primaryReason: { reason: "无法确定", probability: 0, evidence: "", danger: "" }, secondaryReasons: [] },
            safetyWarning: ["操作前请务必断电"],
            repairSteps: [],
            prevention: [],
            references: []
        };
    }

    return aiRes;
}
