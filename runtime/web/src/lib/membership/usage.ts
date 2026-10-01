import { prisma } from "@/lib/prisma";

/**
 * 记录详细的使用日志
 */
export async function logUsage(userId: string, feature: string, metadata?: any) {
    await prisma.usageLog.create({
        data: {
            userId,
            type: feature.toUpperCase(),
            metadata: metadata || {},
        }
    });
}
