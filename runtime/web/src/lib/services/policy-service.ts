import { prisma } from '@/lib/prisma';
import { Policy, PolicyReviewStatus } from '@prisma/client';

/** 进入测算与 AI 回答的政策必须是人工审核通过的 */
export const APPROVED: PolicyReviewStatus = 'APPROVED';

export interface PolicyInput {
    region: string;
    type: string;
    value: number;
    unit: string;
    conditions?: string;
    sourceUrl?: string;
    startDate?: Date;
    endDate?: Date;
    publishedAt?: Date;
    fetchedAt?: Date;
    sourceTitle?: string;
    docNumber?: string;
}

export class PolicyService {
    /**
     * 写入抓取到的政策。抓取/大模型抽取的结果一律记为 PENDING（待人工审核），
     * 已有条目被新抓取结果覆盖时也回到 PENDING 并清空审核人——数字变了就要重新审核。
     */
    static async upsertPolicy(data: PolicyInput) {
        const pending = {
            ...data,
            fetchedAt: data.fetchedAt ?? new Date(),
            reviewStatus: 'PENDING' as PolicyReviewStatus,
            reviewer: null,
            reviewedAt: null,
        };
        const existing = await prisma.policy.findFirst({
            where: {
                region: data.region,
                type: data.type,
                endDate: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (existing) {
            return prisma.policy.update({ where: { id: existing.id }, data: pending });
        }
        return prisma.policy.create({ data: pending });
    }

    /** 人工审核：通过或驳回，记录审核人和时间 */
    static async reviewPolicy(id: string, status: 'APPROVED' | 'REJECTED', reviewer: string) {
        const name = reviewer.trim();
        if (!name) throw new Error('审核人不能为空');
        return prisma.policy.update({
            where: { id },
            data: { reviewStatus: status, reviewer: name, reviewedAt: new Date() },
        });
    }

    /**
     * 当前有效、且**已人工审核通过**的政策（测算只用这些）。
     * 未审核（PENDING）和已驳回（REJECTED）的条目不会影响 IRR。
     */
    static async getActivePolicies(region: string): Promise<Policy[]> {
        const now = new Date();
        return prisma.policy.findMany({
            where: {
                reviewStatus: APPROVED,
                region: {
                    contains: region, // Simple substring match for now
                    mode: 'insensitive',
                },
                OR: [
                    { endDate: null },
                    { endDate: { gt: now } },
                ],
                AND: [
                    { OR: [{ startDate: null }, { startDate: { lte: now } }] }
                ]
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /** 全部政策（后台审核用） */
    static async getAllPolicies() {
        return prisma.policy.findMany({ orderBy: { createdAt: 'desc' } });
    }
}
