import { prisma } from "@/lib/prisma";
import { Plan, USAGE_LIMITS } from "./plans";
import { shouldResetDailyUsage } from "./permissions";

export type IncrementableFeature = 'ai_chat' | 'calculation' | 'resource_query' | 'paper_search' | 'diagnosis';

/**
 * 增加用户每日使用量，并自动检查跨天重置
 */
export async function incrementUsage(userId: string, feature: IncrementableFeature) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            lastResetAt: true,
            dailyAiCalls: true,
            dailyCalculations: true,
            dailyResourceQueries: true,
            dailyPaperSearches: true,
            dailyDiagnoses: true,
        }
    });

    if (!user) return;

    const columnMap: Record<IncrementableFeature, string> = {
        ai_chat: 'dailyAiCalls',
        calculation: 'dailyCalculations',
        resource_query: 'dailyResourceQueries',
        paper_search: 'dailyPaperSearches',
        diagnosis: 'dailyDiagnoses'
    };

    const col = columnMap[feature];

    // 检查是否需要跨天重置
    if (shouldResetDailyUsage(user as any)) {
        await prisma.user.update({
            where: { id: userId },
            data: {
                dailyAiCalls: feature === 'ai_chat' ? 1 : 0,
                dailyCalculations: feature === 'calculation' ? 1 : 0,
                dailyResourceQueries: feature === 'resource_query' ? 1 : 0,
                dailyPaperSearches: feature === 'paper_search' ? 1 : 0,
                dailyDiagnoses: feature === 'diagnosis' ? 1 : 0,
                lastResetAt: new Date(),
            }
        });
    } else {
        // 正常增加
        await prisma.user.update({
            where: { id: userId },
            data: {
                [col]: { increment: 1 }
            }
        });
    }
}

/**
 * 记录详细的使用日志
 */
export async function logUsage(userId: string, feature: string, metadata?: any) {
    await prisma.usageLog.create({
        data: {
            userId,
            feature,
            metadata: metadata || {},
        }
    });
}
