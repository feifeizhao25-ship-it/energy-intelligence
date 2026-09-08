import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PLANS } from '@/lib/auth/config';
import { SolarCalculatorV2 } from './solar-v2';

export class SolarAccessError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

/** 将成功测算、当日用量和项目时间线一同提交，失败时全部回滚。 */
export async function saveSolar(userId: string, projectId: string | null, result: Awaited<ReturnType<typeof SolarCalculatorV2.calculate>>) {
    return prisma.$transaction(async tx => {
        // 同一用户并发请求串行核验会员及配额；不在锁内请求外部天气服务。
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const user = await tx.user.findUnique({ where: { id: userId }, select: { plan: true, planExpireAt: true } });
        if (!user) throw new SolarAccessError(401, '用户不存在，请重新登录');
        if (projectId) {
            const owned = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM projects WHERE id = ${projectId} AND "userId" = ${userId} FOR UPDATE`;
            if (!owned.length) throw new SolarAccessError(404, '项目不存在');
        }
        const now = new Date();
        const plan = user.plan === 'FREE' || !user.planExpireAt || user.planExpireAt <= now ? 'FREE' : user.plan;
        const limit = PLANS[plan].calculations;
        const day = new Date(Math.floor((now.getTime() + 8 * 3600000) / 86400000) * 86400000 - 8 * 3600000);
        const key = { userId, type: 'CALCULATIONS', periodStart: day };
        const usage = await tx.quotaUsage.findUnique({ where: { userId_type_periodStart: key } });
        if (limit !== -1 && (usage?.count ?? 0) >= limit) throw new SolarAccessError(429, '今日测算次数已用完，请明天再试');
        const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
        const snapshot = await tx.calculationSnapshot.create({ data: {
            userId, projectId, calcType: 'SOLAR_REVENUE', calcVersion: result.auditMeta.version,
            assumptionVersion: result.auditMeta.assumptionVersion,
            dataSourceVersion: result.evidence.dataProvenance.solarResource.metadata.responseSha256,
            inputSnapshot: json(result.input), outputSnapshot: json(result.result),
            calculationTrace: json({ assumptions: result.assumptions, auditMeta: result.auditMeta }),
            dataEvidence: json(result.evidence), conclusion: { headline: '光伏初步估算完成', qualityTag: 'PREVIEW' },
            risks: json(result.limitations), nextSteps: [],
        } });
        if (projectId) await tx.projectTimeline.create({ data: {
            id: randomUUID(), projectId, userId, type: 'CALCULATION_PERFORMED', title: '完成光伏初步估算',
            description: '已保存历史辐照来源、估算假设和计算结果，未进行工程审计。',
            auditId: snapshot.id, conclusionId: result.evidence.conclusionId, tags: ['光伏', '初步估算'], isMilestone: true,
        } });
        await tx.quotaUsage.upsert({ where: { userId_type_periodStart: key }, create: { ...key, count: 1 }, update: { count: { increment: 1 } } });
        return snapshot.id;
    });
}
