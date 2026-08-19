// AI工具白名单与沙箱
// 护城河：AI只能调用定义好的工具，不执行任意脚本

import type { OperationRiskLevel } from './types';

/**
 * 工具定义
 */
export interface ToolDefinition {
    // 工具ID
    id: string;
    // 工具名称
    name: string;
    // 描述
    description: string;
    // 分类
    category: 'RESOURCE' | 'CALCULATION' | 'DIAGNOSIS' | 'MAINTENANCE' | 'PAPER' | 'REPORT' | 'SETTINGS' | 'ORCHESTRATOR';
    // 风险级别
    riskLevel: OperationRiskLevel;
    // 是否需要用户确认
    requiresConfirmation: boolean;
    // 需要的配额类型
    quotaType?: string;
    // 需要的权限
    requiredPermissions: string[];
    // 参数定义
    parameters: Record<string, {
        type: string;
        required: boolean;
        description: string;
        validation?: string;
    }>;
    // 是否已启用
    enabled: boolean;
    // 版本
    version: string;
}

/**
 * 工具白名单
 * 只有在白名单中的工具才能被AI调用
 */
export const TOOL_WHITELIST: Record<string, ToolDefinition> = {
    // ========== 资源类（只读） ==========
    get_solar_resource: {
        id: 'get_solar_resource',
        name: '获取太阳能资源',
        description: '从NASA POWER获取指定位置的太阳能资源数据',
        category: 'RESOURCE',
        riskLevel: 'READ_ONLY',
        requiresConfirmation: false,
        quotaType: 'AI_CALLS',
        requiredPermissions: [],
        parameters: {
            lat: { type: 'number', required: true, description: '纬度' },
            lng: { type: 'number', required: true, description: '经度' },
        },
        enabled: true,
        version: '1.0',
    },

    get_wind_resource: {
        id: 'get_wind_resource',
        name: '获取风能资源',
        description: '从NASA POWER获取指定位置的风能资源数据',
        category: 'RESOURCE',
        riskLevel: 'READ_ONLY',
        requiresConfirmation: false,
        quotaType: 'AI_CALLS',
        requiredPermissions: [],
        parameters: {
            lat: { type: 'number', required: true, description: '纬度' },
            lng: { type: 'number', required: true, description: '经度' },
        },
        enabled: true,
        version: '1.0',
    },

    get_current_weather: {
        id: 'get_current_weather',
        name: '获取当前天气',
        description: '获取指定位置的当前天气信息',
        category: 'RESOURCE',
        riskLevel: 'READ_ONLY',
        requiresConfirmation: false,
        requiredPermissions: [],
        parameters: {
            lat: { type: 'number', required: true, description: '纬度' },
            lng: { type: 'number', required: true, description: '经度' },
        },
        enabled: true,
        version: '1.0',
    },

    // ========== 计算类（需配额） ==========
    calculate_solar: {
        id: 'calculate_solar',
        name: '光伏收益测算',
        description: '计算光伏项目25年收益',
        category: 'CALCULATION',
        riskLevel: 'READ_ONLY',
        requiresConfirmation: false,
        quotaType: 'CALCULATIONS',
        requiredPermissions: [],
        parameters: {
            lat: { type: 'number', required: true, description: '纬度' },
            lng: { type: 'number', required: true, description: '经度' },
            capacity: { type: 'number', required: true, description: '装机容量(kW)' },
            province: { type: 'string', required: false, description: '省份' },
        },
        enabled: true,
        version: '1.0',
    },

    calculate_wind: {
        id: 'calculate_wind',
        name: '风电收益测算',
        description: '计算风电项目收益',
        category: 'CALCULATION',
        riskLevel: 'READ_ONLY',
        requiresConfirmation: false,
        quotaType: 'CALCULATIONS',
        requiredPermissions: [],
        parameters: {
            lat: { type: 'number', required: true, description: '纬度' },
            lng: { type: 'number', required: true, description: '经度' },
            capacity: { type: 'number', required: true, description: '单机容量(MW)' },
        },
        enabled: true,
        version: '1.0',
    },

    calculate_storage: {
        id: 'calculate_storage',
        name: '储能收益测算',
        description: '计算储能项目收益',
        category: 'CALCULATION',
        riskLevel: 'READ_ONLY',
        requiresConfirmation: false,
        quotaType: 'CALCULATIONS',
        requiredPermissions: [],
        parameters: {
            capacity: { type: 'number', required: true, description: '容量(MW)' },
            province: { type: 'string', required: true, description: '省份' },
        },
        enabled: true,
        version: '1.0',
    },

    // ========== 诊断类（需配额） ==========
    diagnose_system_health: {
        id: 'diagnose_system_health',
        name: 'PR深度分析',
        description: '分析电站性能比，诊断问题',
        category: 'DIAGNOSIS',
        riskLevel: 'READ_ONLY',
        requiresConfirmation: false,
        quotaType: 'DIAGNOSES',
        requiredPermissions: [],
        parameters: {
            lat: { type: 'number', required: true, description: '纬度' },
            lng: { type: 'number', required: true, description: '经度' },
            capacity: { type: 'number', required: true, description: '装机容量(kW)' },
            actualGeneration: { type: 'number', required: true, description: '实际发电量(kWh)' },
        },
        enabled: true,
        version: '1.0',
    },

    recommend_cleaning: {
        id: 'recommend_cleaning',
        name: '清洗决策建议',
        description: '基于天气和积灰情况推荐清洗时机',
        category: 'DIAGNOSIS',
        riskLevel: 'READ_ONLY',
        requiresConfirmation: false,
        quotaType: 'DIAGNOSES',
        requiredPermissions: [],
        parameters: {
            lat: { type: 'number', required: true, description: '纬度' },
            lng: { type: 'number', required: true, description: '经度' },
            capacity: { type: 'number', required: true, description: '装机容量(kW)' },
            lastCleaningDate: { type: 'string', required: true, description: '上次清洗日期' },
        },
        enabled: true,
        version: '1.0',
    },

    // ========== 运维类（需确认） ==========
    generate_work_permit: {
        id: 'generate_work_permit',
        name: '生成工作票',
        description: '生成运维工作票',
        category: 'MAINTENANCE',
        riskLevel: 'HIGH_WRITE',
        requiresConfirmation: true,
        requiredPermissions: ['maintenance:write'],
        parameters: {
            type: { type: 'string', required: true, description: '工作类型' },
            stationName: { type: 'string', required: true, description: '电站名称' },
            location: { type: 'string', required: true, description: '工作地点' },
        },
        enabled: true,
        version: '1.0',
    },

    // ========== 论文类 ==========
    search_papers: {
        id: 'search_papers',
        name: '搜索论文',
        description: '搜索新能源领域学术论文',
        category: 'PAPER',
        riskLevel: 'READ_ONLY',
        requiresConfirmation: false,
        quotaType: 'PAPER_SEARCHES',
        requiredPermissions: [],
        parameters: {
            query: { type: 'string', required: true, description: '搜索关键词' },
            limit: { type: 'number', required: false, description: '返回数量' },
        },
        enabled: true,
        version: '1.0',
    },

    generate_paper_summary: {
        id: 'generate_paper_summary',
        name: '生成论文摘要',
        description: 'AI生成论文一句话摘要',
        category: 'PAPER',
        riskLevel: 'READ_ONLY',
        requiresConfirmation: false,
        quotaType: 'PAPER_SUMMARIES',
        requiredPermissions: [],
        parameters: {
            paperId: { type: 'string', required: true, description: '论文ID' },
        },
        enabled: true,
        version: '1.0',
    },

    // ========== 编排器类 ==========
    get_project_next_steps: {
        id: 'get_project_next_steps',
        name: '获取下一步推荐',
        description: '基于项目状态获取智能推荐',
        category: 'ORCHESTRATOR',
        riskLevel: 'READ_ONLY',
        requiresConfirmation: false,
        requiredPermissions: [],
        parameters: {
            projectId: { type: 'string', required: true, description: '项目ID' },
            userId: { type: 'string', required: true, description: '用户ID' },
        },
        enabled: true,
        version: '1.0',
    },

    // ========== 报告类（需配额） ==========
    generate_report: {
        id: 'generate_report',
        name: '生成报告',
        description: '生成项目分析报告',
        category: 'REPORT',
        riskLevel: 'READ_ONLY',
        requiresConfirmation: false,
        quotaType: 'EXPORTS',
        requiredPermissions: ['report:generate'],
        parameters: {
            projectId: { type: 'string', required: true, description: '项目ID' },
            reportType: { type: 'string', required: true, description: '报告类型' },
        },
        enabled: true,
        version: '1.0',
    },
};

/**
 * 检查工具是否在白名单中
 */
export function isToolAllowed(toolName: string): boolean {
    const tool = TOOL_WHITELIST[toolName];
    return tool !== undefined && tool.enabled;
}

/**
 * 获取工具定义
 */
export function getToolDefinition(toolName: string): ToolDefinition | undefined {
    return TOOL_WHITELIST[toolName];
}

/**
 * 获取工具风险级别
 */
export function getToolRiskLevel(toolName: string): OperationRiskLevel | undefined {
    return TOOL_WHITELIST[toolName]?.riskLevel;
}

/**
 * 检查工具调用权限
 */
export function checkToolPermission(
    toolName: string,
    userPermissions: string[]
): { allowed: boolean; reason?: string } {
    const tool = TOOL_WHITELIST[toolName];

    if (!tool) {
        return { allowed: false, reason: '工具不在白名单中' };
    }

    if (!tool.enabled) {
        return { allowed: false, reason: '工具已被禁用' };
    }

    // 检查权限
    for (const required of tool.requiredPermissions) {
        if (!userPermissions.includes(required)) {
            return { allowed: false, reason: `缺少权限: ${required}` };
        }
    }

    return { allowed: true };
}

/**
 * 沙箱执行工具
 * 确保工具调用安全
 */
export async function sandboxExecuteTool(
    toolName: string,
    params: Record<string, unknown>,
    context: {
        userId: string;
        permissions: string[];
        quotaCheck: boolean;
    }
): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
    requiresConfirmation?: boolean;
}> {
    // 1. 检查白名单
    if (!isToolAllowed(toolName)) {
        return { success: false, error: `工具 ${toolName} 不在允许列表中` };
    }

    // 2. 检查权限
    const permCheck = checkToolPermission(toolName, context.permissions);
    if (!permCheck.allowed) {
        return { success: false, error: permCheck.reason };
    }

    const tool = TOOL_WHITELIST[toolName]!;

    // 3. 检查是否需要确认
    if (tool.requiresConfirmation) {
        return {
            success: false,
            requiresConfirmation: true,
            error: `操作需要用户确认: ${tool.name}`,
        };
    }

    // 4. 检查配额（由调用方处理）
    if (context.quotaCheck && tool.quotaType) {
        // 配额检查逻辑由调用方实现
    }

    // 5. 参数验证
    for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
        if (paramDef.required && !(paramName in params)) {
            return { success: false, error: `缺少必需参数: ${paramName}` };
        }
    }

    // 6. 委托给实际执行器
    // 注意：这里不直接执行，返回验证通过即可
    return { success: true };
}

/**
 * 获取可用工具列表（用于AI系统提示）
 */
export function getAvailableTools(userPermissions: string[]): ToolDefinition[] {
    return Object.values(TOOL_WHITELIST)
        .filter(tool => {
            if (!tool.enabled) return false;
            return tool.requiredPermissions.every(p => userPermissions.includes(p) || tool.requiredPermissions.length === 0);
        });
}

/**
 * 获取工具分类
 */
export function getToolsByCategory(): Record<string, ToolDefinition[]> {
    const result: Record<string, ToolDefinition[]> = {};

    for (const tool of Object.values(TOOL_WHITELIST)) {
        if (!result[tool.category]) {
            result[tool.category] = [];
        }
        result[tool.category].push(tool);
    }

    return result;
}
