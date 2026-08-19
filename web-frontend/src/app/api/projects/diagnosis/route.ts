import { NextRequest, NextResponse } from 'next/server';
import { simpleChat } from '@/lib/ai/unified';

interface DiagnosisResult {
    summary: string;
    status: 'healthy' | 'warning' | 'critical';
    scores: {
        overall: number;
        efficiency: number;
        maintenance: number;
        safety: number;
    };
    issues: Array<{
        type: 'warning' | 'error' | 'info';
        title: string;
        description: string;
        recommendation: string;
    }>;
    recommendations: string[];
    nextMaintenanceDate: string;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { projectId, projectName, projectType, capacity, location, dailyGen, health } = body;

        // 构建 Prompt 让 AI 进行结构化诊断
        const prompt = `
你是一位专业的新能源电站运维专家和数据分析师。请对以下电站进行智能诊断分析，并以 **严格的 JSON 格式** 返回结果。

## 电站信息
- 电站名称: ${projectName || '未命名电站'}
- 电站类型: ${projectType === 'solar' ? '光伏电站' : projectType === 'wind' ? '风力电站' : '储能电站'}
- 装机容量: ${capacity || 100} kW
- 地理位置: ${location || '未知'}
- 今日发电: ${dailyGen || 0} kWh
- 健康评分: ${health || 0}/100

## 分析要求
1. 综合评估电站运行状况
2. 分析可能存在的问题和风险
3. 给出维护建议和优化方案
4. 预测下次维护时间

## 返回格式 (必须是有效JSON)
{
    "summary": "一句话总结电站状态",
    "status": "healthy | warning | critical",
    "scores": {
        "overall": 0-100,
        "efficiency": 0-100,
        "maintenance": 0-100,
        "safety": 0-100
    },
    "issues": [
        {
            "type": "warning | error | info",
            "title": "问题标题",
            "description": "详细描述",
            "recommendation": "建议措施"
        }
    ],
    "recommendations": ["建议1", "建议2"],
    "nextMaintenanceDate": "YYYY-MM-DD"
}

只返回 JSON，不要任何其他文字。
`;

        const response = await simpleChat(prompt, 'deepseek-v3');

        // 尝试解析 JSON
        let diagnosis: DiagnosisResult;
        try {
            // 清理可能的 markdown 标记
            const cleanJson = response.replace(/```json|```/g, '').trim();
            diagnosis = JSON.parse(cleanJson);
        } catch (parseError) {
            console.warn('AI response parse failed, using fallback:', parseError);
            // 返回备用结构
            diagnosis = {
                summary: '电站运行状态基本正常，建议定期维护。',
                status: health > 80 ? 'healthy' : health > 60 ? 'warning' : 'critical',
                scores: {
                    overall: health || 85,
                    efficiency: Math.min(100, (health || 85) + 5),
                    maintenance: Math.max(0, (health || 85) - 10),
                    safety: 95
                },
                issues: capacity && dailyGen && (dailyGen / capacity < 2) ? [
                    {
                        type: 'warning',
                        title: '发电效率偏低',
                        description: `今日发电量 ${dailyGen} kWh 低于预期值`,
                        recommendation: '建议检查逆变器效率和组件清洁度'
                    }
                ] : [],
                recommendations: [
                    '按计划执行季度维护检查',
                    '监控逆变器转换效率',
                    '保持组件表面清洁'
                ],
                nextMaintenanceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            };
        }

        return NextResponse.json({
            success: true,
            data: diagnosis
        });

    } catch (error: any) {
        console.error('AI Diagnosis failed:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Diagnosis failed'
        }, { status: 500 });
    }
}
