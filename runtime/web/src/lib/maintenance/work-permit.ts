import { simpleChat } from '../ai/unified';
import { WorkPermitInput, WorkPermit } from './types';

/**
 * 检修作业票生成
 */
export async function generateWorkPermit(input: WorkPermitInput): Promise<WorkPermit> {
    const { type, stationName, location, planDate, staffCount } = input;

    const prompt = `
你是一个电力安全运营专家。请为以下光伏/风电维护作业生成一份标准的专业工作票。

【作业信息】
电站名称：${stationName}
作业类型：${type} (清洗/逆变器/线路/故障抢修)
地点：${location}
时间：${planDate}
人数：${staffCount}

要求根据中国国家电力安全标准 (如 GB 26860)，生成详细的作业票内容。
请返回 JSON 格式：
{
  "header": {
    "id": "WP-YYYYMMDD-XXX",
    "type": "作业类型名称",
    "group": "建议运维班组单位",
    "issuedAt": "当前日期"
  },
  "content": {
    "tasks": ["具体任务1", "任务2"],
    "location": "${location}",
    "timeframe": "${planDate} 08:00 - 18:00"
  },
  "safety": {
    "riskPoints": [
      { "point": "危险点", "control": "控制措施" }
    ],
    "tools": {
      "electrical": ["电工工具1"],
      "mechanical": ["机械工具1"],
      "safety": ["安全带", "安全帽"]
    }
  },
  "steps": ["准备工作", "停电操作", "实施作业", "结束清理"],
  "acceptance": ["验收标准1", "标准2"]
}
`;

    const aiResRaw = await simpleChat(prompt);
    let aiRes;
    try {
        const jsonStr = aiResRaw.replace(/```json|```/g, '').trim();
        aiRes = JSON.parse(jsonStr);
    } catch (e) {
        aiRes = {
            header: { id: "ERR-001", type, group: "运维班", issuedAt: new Date().toLocaleDateString() },
            content: { tasks: [], location, timeframe: planDate },
            safety: { riskPoints: [], tools: { electrical: [], mechanical: [], safety: [] } },
            steps: [],
            acceptance: []
        };
    }

    return aiRes;
}
