// AI助手工具定义

import { prisma } from '@/lib/prisma';

// 工具定义
export const AI_TOOLS = {
  // 计算工具
  calculate: {
    name: 'calculate',
    description: '进行数学计算或财务计算',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: '计算表达式' },
        context: { type: 'string', description: '计算上下文说明' },
      },
      required: ['expression'],
    },
    handler: async (params: { expression: string; context?: string }) => {
      try {
        // 安全地计算表达式
        const result = safeCalculate(params.expression);
        return {
          success: true,
          result,
          context: params.context,
        };
      } catch (error) {
        return {
          success: false,
          error: '计算失败：' + (error as Error).message,
        };
      }
    },
  },

  // 查询政策
  query_policy: {
    name: 'query_policy',
    description: '查询特定地区的新能源政策和补贴信息',
    parameters: {
      type: 'object',
      properties: {
        region: { type: 'string', description: '地区名称，如"北京"、"广东"' },
        type: { type: 'string', enum: ['solar', 'wind', 'storage', 'all'], description: '能源类型' },
        year: { type: 'number', description: '年份，默认为当前年份' },
      },
      required: ['region'],
    },
    handler: async (params: { region: string; type?: string; year?: number }) => {
      try {
        // 查询数据库中的政策
        const policies = await prisma.policy.findMany({
          where: {
            region: { contains: params.region },
            ...(params.type && params.type !== 'all' ? { type: params.type } : {}),
            OR: [
              { endDate: null },
              { endDate: { gte: new Date() } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        if (policies.length === 0) {
          return {
            success: true,
            message: `未找到${params.region}的最新政策信息，建议咨询当地发改委或电网公司。`,
            policies: [],
          };
        }

        return {
          success: true,
          region: params.region,
          policies: policies.map(p => ({
            type: p.type,
            value: p.value,
            unit: p.unit,
            conditions: p.conditions,
            endDate: p.endDate,
          })),
        };
      } catch (error) {
        return {
          success: false,
          error: '查询失败：' + (error as Error).message,
        };
      }
    },
  },

  // 获取电价
  get_electricity_price: {
    name: 'get_electricity_price',
    description: '获取特定地区的电价信息',
    parameters: {
      type: 'object',
      properties: {
        region: { type: 'string', description: '地区名称' },
        type: { type: 'string', enum: ['residential', 'commercial', 'industrial'], description: '用电类型' },
      },
      required: ['region'],
    },
    handler: async (params: { region: string; type?: string }) => {
      // 这里应该查询电价数据库
      // 模拟返回
      const prices: Record<string, any> = {
        '北京': {
          residential: { peak: 0.4883, valley: 0.2883, flat: 0.3883 },
          commercial: { peak: 1.2, valley: 0.6, flat: 0.9 },
        },
        '上海': {
          residential: { peak: 0.617, valley: 0.307, flat: 0.462 },
          commercial: { peak: 1.1, valley: 0.55, flat: 0.825 },
        },
      };

      const regionPrices = prices[params.region] || prices['北京'];
      const typePrices = params.type ? regionPrices[params.type] : regionPrices;

      return {
        success: true,
        region: params.region,
        type: params.type || 'all',
        prices: typePrices,
        note: '以上价格为参考值，实际电价以电网公司公布为准',
      };
    },
  },

  // 比较方案
  compare_scenarios: {
    name: 'compare_scenarios',
    description: '比较不同投资方案的优劣',
    parameters: {
      type: 'object',
      properties: {
        scenarios: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              investment: { type: 'number' },
              annualRevenue: { type: 'number' },
              paybackYears: { type: 'number' },
              irr: { type: 'number' },
            },
            required: ['name', 'investment', 'annualRevenue'],
          },
        },
        criteria: { type: 'array', items: { type: 'string' }, description: '比较维度' },
      },
      required: ['scenarios'],
    },
    handler: async (params: { scenarios: any[]; criteria?: string[] }) => {
      // 计算各种指标
      const analyzed = params.scenarios.map(s => ({
        ...s,
        roi: ((s.annualRevenue * 25 - s.investment) / s.investment * 100).toFixed(1),
        npv: (s.annualRevenue * 20 - s.investment).toFixed(0),
      }));

      // 排序推荐
      const ranked = [...analyzed].sort((a, b) => b.irr - a.irr);

      return {
        success: true,
        scenarios: analyzed,
        recommendation: ranked[0],
        ranking: ranked.map((s, i) => ({ rank: i + 1, name: s.name, score: s.irr })),
      };
    },
  },

  // 生成报告
  generate_report: {
    name: 'generate_report',
    description: '生成投资分析报告',
    parameters: {
      type: 'object',
      properties: {
        projectData: { type: 'object', description: '项目数据' },
        reportType: { type: 'string', enum: ['summary', 'detailed', 'financial'], description: '报告类型' },
        format: { type: 'string', enum: ['markdown', 'json'], description: '输出格式' },
      },
      required: ['projectData'],
    },
    handler: async (params: { projectData: any; reportType?: string; format?: string }) => {
      // 生成报告摘要
      const summary = {
        title: `${params.projectData.location?.city || '未知'}光伏项目投资分析报告`,
        executiveSummary: `该项目装机容量${params.projectData.capacity}kW，预计投资${params.projectData.investment}万元，25年总收益${params.projectData.totalRevenue}万元，投资回收期${params.projectData.paybackYears}年。`,
        keyMetrics: {
          irr: params.projectData.irr,
          npv: params.projectData.netProfit,
          lcoe: params.projectData.lcoe,
          carbonReduction: params.projectData.carbonReduction,
        },
        recommendations: [
          '项目IRR超过8%，建议投资',
          '建议选择可靠的EPC承包商',
          '关注当地政策变化',
        ],
      };

      return {
        success: true,
        report: summary,
        format: params.format || 'markdown',
      };
    },
  },

  // 获取项目下一步推荐
  get_project_next_steps: {
    name: 'get_project_next_steps',
    description: '获取项目的下一步推荐动作，基于项目当前状态智能推荐',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目ID' },
        userId: { type: 'string', description: '用户ID' },
      },
      required: ['projectId', 'userId'],
    },
    handler: async (params: { projectId: string; userId: string }) => {
      try {
        const { buildOrchestratorResponse } = await import('@/lib/orchestrator');
        const response = await buildOrchestratorResponse(params.projectId, params.userId);

        return {
          success: true,
          stage: response.stage,
          stageName: response.stageMeta.name,
          stageConfidence: response.stageConfidence,
          recommendations: response.recommendedActions.slice(0, 5).map(a => ({
            title: a.title,
            description: a.description,
            priority: a.priority,
            reason: a.rationale.summary,
            requiresPro: !!a.requiresPlan,
          })),
          checklist: response.checklist.map(c => ({
            task: c.label,
            done: c.done,
            recommended: c.recommended,
          })),
          summary: `项目当前处于"${response.stageMeta.name}"阶段，有${response.recommendedActions.length}条推荐动作`,
        };
      } catch (error) {
        return {
          success: false,
          error: '获取推荐失败：' + (error as Error).message,
        };
      }
    },
  },
};

// 安全计算函数
function safeCalculate(expression: string): number {
  // 只允许数字和基本运算符
  const sanitized = expression.replace(/[^0-9+\-*/.()\s]/g, '');
  if (sanitized !== expression.trim()) {
    throw new Error('表达式包含非法字符');
  }

  // 使用Function代替eval（仍然需要谨慎）
  const result = new Function('return ' + sanitized)();
  return Number(result);
}

// 执行工具调用
export async function executeTool(name: string, params: any): Promise<any> {
  const tool = Object.values(AI_TOOLS).find(t => t.name === name);
  if (!tool) {
    return { success: false, error: `未知工具: ${name}` };
  }

  return tool.handler(params);
}

// 获取工具定义（用于AI）
export function getToolDefinitions() {
  return Object.values(AI_TOOLS).map(({ name, description, parameters }) => ({
    type: 'function',
    function: {
      name,
      description,
      parameters,
    },
  }));
}
