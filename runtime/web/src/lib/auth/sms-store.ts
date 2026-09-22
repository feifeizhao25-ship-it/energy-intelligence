import { prisma } from '@/lib/prisma';
import { MAX_ATTEMPTS, type CodeStore } from './sms-verify';

export const prismaCodeStore: CodeStore = {
    latestActive: (phone, _now) => prisma.verificationCode.findFirst({
        // Always inspect the newest issuance; never revive an older unused code.
        where: { phone },
        orderBy: { createdAt: 'desc' },
    }),
    claimAttempt: async (id, now) => {
        const { count } = await prisma.verificationCode.updateMany({
            where: { id, used: false, attempts: { lt: MAX_ATTEMPTS }, expiresAt: { gt: now } },
            data: { attempts: { increment: 1 } },
        });
        return count === 1;
    },
    consume: async (id, now) => {
        const { count } = await prisma.verificationCode.updateMany({ where: { id, used: false, attempts: { lte: MAX_ATTEMPTS }, expiresAt: { gt: now } }, data: { used: true } });
        return count === 1;
    },
};
