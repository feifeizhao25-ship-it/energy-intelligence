import { prisma } from '@/lib/prisma';
import { Policy } from '@prisma/client';

export class PolicyService {
    /**
     * Create or update a policy
     */
    static async upsertPolicy(data: {
        region: string;
        type: string;
        value: number;
        unit: string;
        conditions?: string;
        sourceUrl?: string;
        startDate?: Date;
        endDate?: Date;
    }) {
        // We don't have a unique constraint on (region, type) in the schema yet,
        // so for now we'll just create a new one.
        // Ideally we should have a unique constraint or check for existence.
        // Let's check for an existing active policy of the same type in the region
        const existing = await prisma.policy.findFirst({
            where: {
                region: data.region,
                type: data.type,
                // Check if it's currently valid or future dated
                endDate: {
                    gt: new Date(),
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        if (existing) {
            return prisma.policy.update({
                where: { id: existing.id },
                data,
            });
        }

        return prisma.policy.create({
            data,
        });
    }

    /**
     * Get active policies for a region
     */
    static async getActivePolicies(region: string): Promise<Policy[]> {
        const now = new Date();

        // We'll search for policies that match the region.
        // In a real app, we might need fuzzy matching or hierarchical lookup (e.g. Shanghai in China)
        return prisma.policy.findMany({
            where: {
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
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    /**
     * Get all policies (for admin view)
     */
    static async getAllPolicies() {
        return prisma.policy.findMany({
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
}
