// OpenClaw Skill 集成
// 护城河策略：把通用Agent变成分发渠道，而不是对手

/**
 * OpenClaw Skill 定义
 * 遵循 OpenClaw 的 skill 格式规范
 */
export interface OpenClawSkill {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    homepage: string;
    apiEndpoint: string;
    authType: 'API_KEY' | 'OAUTH' | 'NONE';
    capabilities: OpenClawCapability[];
    rateLimit: {
        requests: number;
        period: 'minute' | 'hour' | 'day';
    };
    pricing: {
        type: 'FREE' | 'FREEMIUM' | 'PAID';
        freeQuota?: number;
    };
}

/**
 * OpenClaw 能力定义
 */
export interface OpenClawCapability {
    id: string;
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    examples: Array<{
        input: Record<string, unknown>;
        output: Record<string, unknown>;
    }>;
}

/**
 * 新能源智库 OpenClaw Skill 配置
 */
export const XINNENGYUAN_SKILL: OpenClawSkill = {
    id: 'xinnengyuan-ai',
    name: '新能源智库',
    description: '新能源项目全生命周期智能助手：选址评估、收益测算、运维诊断、文献检索',
    version: '1.0.0',
    author: 'XinNengYuan Team',
    homepage: 'https://xinnengyuan.ai',
    apiEndpoint: 'https://api.xinnengyuan.ai/v1/openclaw',
    authType: 'API_KEY',
    capabilities: [
        {
            id: 'solar_assessment',
            name: '光伏收益评估',
            description: '输入位置坐标，获取太阳能资源评估和收益预测',
            inputSchema: {
                type: 'object',
                properties: {
                    lat: { type: 'number', description: '纬度' },
                    lng: { type: 'number', description: '经度' },
                    capacity: { type: 'number', description: '装机容量(kW)', default: 10 },
                },
                required: ['lat', 'lng'],
            },
            outputSchema: {
                type: 'object',
                properties: {
                    resource: {
                        type: 'object',
                        properties: {
                            annualGHI: { type: 'number', description: '年辐照量(kWh/m²)' },
                            resourceClass: { type: 'string', description: '资源等级' },
                            optimalTilt: { type: 'number', description: '最佳倾角' },
                        },
                    },
                    economics: {
                        type: 'object',
                        properties: {
                            irr: { type: 'number', description: '内部收益率' },
                            paybackYears: { type: 'number', description: '回收期' },
                            totalRevenue25: { type: 'number', description: '25年总收益(万元)' },
                        },
                    },
                    recommendation: { type: 'string', description: '投资建议' },
                    reportUrl: { type: 'string', description: '详细报告链接' },
                },
            },
            examples: [
                {
                    input: { lat: 39.9, lng: 116.4, capacity: 20 },
                    output: {
                        resource: { annualGHI: 1420, resourceClass: 'II类', optimalTilt: 35 },
                        economics: { irr: 0.12, paybackYears: 6.5, totalRevenue25: 45.2 },
                        recommendation: '资源条件良好，IRR达12%，建议投资',
                        reportUrl: 'https://xinnengyuan.ai/report/xxx',
                    },
                },
            ],
        },
        {
            id: 'wind_assessment',
            name: '风电收益评估',
            description: '输入位置坐标，获取风能资源评估和收益预测',
            inputSchema: {
                type: 'object',
                properties: {
                    lat: { type: 'number', description: '纬度' },
                    lng: { type: 'number', description: '经度' },
                    capacity: { type: 'number', description: '装机容量(MW)', default: 5 },
                },
                required: ['lat', 'lng'],
            },
            outputSchema: {
                type: 'object',
                properties: {
                    resource: {
                        type: 'object',
                        properties: {
                            avgWindSpeed: { type: 'number', description: '年均风速(m/s)' },
                            windPowerDensity: { type: 'number', description: '风功率密度(W/m²)' },
                            equivalentHours: { type: 'number', description: '等效利用小时' },
                        },
                    },
                    economics: {
                        type: 'object',
                        properties: {
                            irr: { type: 'number', description: '内部收益率' },
                            paybackYears: { type: 'number', description: '回收期' },
                        },
                    },
                },
            },
            examples: [],
        },
        {
            id: 'pr_diagnosis',
            name: 'PR诊断分析',
            description: '诊断电站性能比偏低的原因，给出优先级排序的维护建议',
            inputSchema: {
                type: 'object',
                properties: {
                    lat: { type: 'number', description: '纬度' },
                    lng: { type: 'number', description: '经度' },
                    capacity: { type: 'number', description: '装机容量(kW)' },
                    actualGeneration: { type: 'number', description: '实际发电量(kWh)' },
                    period: { type: 'string', description: '时间段', default: 'last_month' },
                },
                required: ['lat', 'lng', 'capacity', 'actualGeneration'],
            },
            outputSchema: {
                type: 'object',
                properties: {
                    pr: { type: 'number', description: '性能比' },
                    status: { type: 'string', description: '健康状态' },
                    findings: { type: 'array', description: '问题发现' },
                    actions: { type: 'array', description: '建议动作（按优先级）' },
                    estimatedLoss: { type: 'number', description: '预估月损失(元)' },
                },
            },
            examples: [],
        },
        {
            id: 'paper_search',
            name: '学术论文检索',
            description: '搜索新能源领域学术论文，获取AI摘要',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: '搜索关键词' },
                    limit: { type: 'number', description: '返回数量', default: 5 },
                    yearFrom: { type: 'number', description: '起始年份' },
                },
                required: ['query'],
            },
            outputSchema: {
                type: 'object',
                properties: {
                    papers: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                authors: { type: 'array' },
                                year: { type: 'number' },
                                summary: { type: 'string', description: 'AI一句话摘要' },
                                url: { type: 'string' },
                            },
                        },
                    },
                    totalCount: { type: 'number' },
                },
            },
            examples: [],
        },
    ],
    rateLimit: {
        requests: 100,
        period: 'day',
    },
    pricing: {
        type: 'FREEMIUM',
        freeQuota: 10, // 每天10次免费
    },
};

/**
 * 处理 OpenClaw 请求
 */
export async function handleOpenClawRequest(
    capabilityId: string,
    input: Record<string, unknown>,
    apiKey: string
): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
    quotaRemaining?: number;
}> {
    // 验证 API Key
    const keyValid = await validateOpenClawApiKey(apiKey);
    if (!keyValid.valid) {
        return { success: false, error: keyValid.reason };
    }

    // 检查配额
    const quota = await checkOpenClawQuota(keyValid.apiKeyId!);
    if (!quota.allowed) {
        return {
            success: false,
            error: '今日免费额度已用完，请访问 xinnengyuan.ai 升级',
            quotaRemaining: 0,
        };
    }

    // 路由到对应能力
    try {
        let result: unknown;

        switch (capabilityId) {
            case 'solar_assessment':
                result = await handleSolarAssessment(input);
                break;
            case 'wind_assessment':
                result = await handleWindAssessment(input);
                break;
            case 'pr_diagnosis':
                result = await handlePRDiagnosis(input);
                break;
            case 'paper_search':
                result = await handlePaperSearch(input);
                break;
            default:
                return { success: false, error: `Unknown capability: ${capabilityId}` };
        }

        // 消耗配额
        await consumeOpenClawQuota(keyValid.apiKeyId!, keyValid.userId!, capabilityId);

        return {
            success: true,
            data: result,
            quotaRemaining: quota.remaining - 1,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Internal error',
        };
    }
}

// ========== 内部处理函数 ==========

async function validateOpenClawApiKey(apiKey: string): Promise<{ valid: boolean; reason?: string; apiKeyId?: string; userId?: string }> {
    if (!apiKey || !apiKey.startsWith('xny_')) {
        return { valid: false, reason: 'Invalid API key format' };
    }
    const { prisma } = await import('@/lib/prisma');
    const crypto = await import('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const record = await prisma.apiKey.findUnique({ where: { keyHash } });
    if (!record || record.status !== 'ACTIVE' || (record.expiresAt && record.expiresAt <= new Date())) {
        return { valid: false, reason: 'Invalid or expired API key' };
    }
    const permissions = Array.isArray(record.permissions) ? record.permissions : [];
    if (!permissions.includes('openclaw:execute')) {
        return { valid: false, reason: 'API key lacks openclaw:execute permission' };
    }
    await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    return { valid: true, apiKeyId: record.id, userId: record.userId };
}

async function checkOpenClawQuota(apiKeyId: string): Promise<{ allowed: boolean; remaining: number }> {
    const { prisma } = await import('@/lib/prisma');
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const used = await prisma.apiLog.count({
        where: { apiKeyId, endpoint: '/api/v1/openclaw', createdAt: { gte: start }, status: 200 },
    });
    return { allowed: used < 10, remaining: Math.max(0, 10 - used) };
}

async function consumeOpenClawQuota(apiKeyId: string, userId: string, capability: string): Promise<void> {
    const { prisma } = await import('@/lib/prisma');
    await prisma.apiLog.create({
        data: {
            apiKeyId,
            userId,
            endpoint: '/api/v1/openclaw',
            method: 'POST',
            input: { capability },
            duration: 0,
            status: 200,
        },
    });
}

async function handleSolarAssessment(input: Record<string, unknown>): Promise<unknown> {
    // 调用内部服务
    const { getSolarResource } = await import('@/lib/api/nasa-power');
    const { calculateSolar } = await import('@/lib/calculator/solar');

    const lat = input.lat as number;
    const lng = input.lng as number;
    const capacity = (input.capacity as number) || 10;

    const resource = await getSolarResource(lat, lng);
    const result = await calculateSolar({
        lat,
        lng,
        capacity,
        installationType: 'roof',
        moduleType: 'standard',
        selfUseRatio: 0.3,
        electricityPrice: 0.5,
        feedInTariff: 0.3,
        province: '默认',
    });

    return {
        resource: {
            annualGHI: resource.annual.ghi,
            resourceClass: resource.annual.resourceClass,
            optimalTilt: resource.annual.optimalTilt,
        },
        economics: {
            irr: result.financial?.irr || 0,
            paybackYears: result.financial?.paybackYears || 0,
            totalRevenue25: result.financial?.cashFlow.reduce((sum, value) => sum + Math.max(0, value), 0) || 0,
        },
        recommendation: (result.financial?.irr || 0) > 0.08
            ? '资源条件良好，建议投资'
            : '收益率偏低，建议谨慎评估',
        reportUrl: `https://xinnengyuan.ai/quick-calc/solar?lat=${lat}&lng=${lng}`,
    };
}

async function handleWindAssessment(input: Record<string, unknown>): Promise<unknown> {
    const { getWindResource } = await import('@/lib/api/nasa-power');

    const lat = input.lat as number;
    const lng = input.lng as number;

    const resource = await getWindResource(lat, lng);

    return {
        resource: {
            avgWindSpeed: resource.annual.avgSpeed,
            windPowerDensity: resource.annual.powerDensity,
            equivalentHours: resource.annual.equivalentHours,
        },
        economics: {
            irr: resource.annual.avgSpeed > 6 ? 0.10 : 0.06,
            paybackYears: resource.annual.avgSpeed > 6 ? 7 : 12,
        },
    };
}

async function handlePRDiagnosis(input: Record<string, unknown>): Promise<unknown> {
    const { analyzePR } = await import('@/lib/maintenance/pr-analysis');

    const result = await analyzePR({
        lat: input.lat as number,
        lng: input.lng as number,
        capacity: input.capacity as number,
        actualGeneration: input.actualGeneration as number,
        startDate: '',
        endDate: '',
    });

    return {
        pr: result.performance.pr,
        status: result.performance.pr >= 0.8 ? 'HEALTHY' : 'NEEDS_ATTENTION',
        findings: result.diagnostics,
        actions: result.actionList,
        estimatedLoss: result.economicLoss.monthlyLossRevenue,
    };
}

async function handlePaperSearch(input: Record<string, unknown>): Promise<unknown> {
    const { searchPapers } = await import('@/lib/api/semantic-scholar');

    const papers = await searchPapers(input.query as string, {
        limit: (input.limit as number) || 5,
        yearFrom: input.yearFrom as number,
    });

    return {
        papers: papers.papers.map((p: any) => ({
            title: p.title,
            authors: p.authors?.map((a: any) => a.name) || [],
            year: p.year,
            summary: p.tldr || p.abstract?.substring(0, 200) + '...',
            url: p.url,
        })),
        totalCount: papers.total,
    };
}
