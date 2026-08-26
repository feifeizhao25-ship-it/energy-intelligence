import { simpleChat } from '../ai/unified';
import { WindDiagnosisInput } from './types';

/**
 * 风机故障智能诊断
 */
export async function diagnoseWindTurbine(input: WindDiagnosisInput) {
    const { system, errorCode, symptoms } = input;

    const prompt = `
你是一个资深风电运维专家，精通金风、远景、明阳、阳光电源、Vestas、Siemens Gamesa 等主流风机品牌。
请针对以下风机故障进行专业智能诊断。

【系统模块】
涉及系统：${system} (变桨/齿轮箱/发电机/变流器/偏航/主控)
故障代码：${errorCode || '无'}
故障现象：${symptoms || '未提供'}

请返回专业的诊断报告 (JSON 格式):
{
  "header": {
    "system": "${system}",
    "errorCode": "${errorCode}",
    "severity": "紧急/高/中/低"
  },
  "diagnosis": {
    "conclusion": "主诊断结论",
    "rootReason": "根本原因分析",
    "possibilities": [
      { "reason": "可能原因1", "prob": 0.7, "impact": "影响描述" }
    ]
  },
  "safety": ["针对该模块的特有安全警告"],
  "actions": [
    { "step": "操作步骤", "detail": "具体细节", "order": 1 }
  ],
  "monitoring": ["后续需要重点监控的参数"]
}

注意：
- 变桨系统故障重点关注编码器、电池组、滑环。
- 齿轮箱重点关注油压、油温、震动。
- 偏航重点关注制动钳、偏航压力、扭缆状态。
`;

    const aiResRaw = await simpleChat(prompt);
    let aiRes;
    try {
        const jsonStr = aiResRaw.replace(/```json|```/g, '').trim();
        aiRes = JSON.parse(jsonStr);
    } catch (e) {
        aiRes = {
            header: { system, errorCode: errorCode || '', severity: "高" },
            diagnosis: { conclusion: "诊断异常，请联系技术支持" },
            safety: ["严格遵守登塔安全操作规程"],
            actions: []
        };
    }

    return aiRes;
}
