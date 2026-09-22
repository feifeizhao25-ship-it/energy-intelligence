import { prisma } from '@/lib/prisma';
import type { CodeStore } from './sms-verify';

export const prismaCodeStore: CodeStore = {
    latestActive: (phone, now) => prisma.verificationCode.findFirst({
        where: { phone, used: false, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
    }),
    recordFailure: async (id, attempts, exhausted) => {
        await prisma.verificationCode.update({ where: { id }, data: { attempts, ...(exhausted ? { used: true } : {}) } });
    },
    consume: async (id) => {
        const { count } = await prisma.verificationCode.updateMany({ where: { id, used: false }, data: { used: true } });
        return count === 1;
    },
};
