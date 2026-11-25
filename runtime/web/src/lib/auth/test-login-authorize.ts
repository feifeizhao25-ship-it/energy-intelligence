import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { consentRecord } from '@/lib/legal/consent';
import { testLoginEnabled } from './test-login';
import { syntheticAccountEmail } from './auth-options';

const TEST_PHONE = '19900001111';

/** 只给已打开的测试登录通道使用。正式构建里 provider 不会调用它。 */
export async function authorizeTestLogin() {
    if (!testLoginEnabled()) return null;
    const consent = consentRecord();
    let user = await prisma.user.findFirst({ where: { phone: TEST_PHONE, deletedAt: null } });
    if (!user) {
        user = await prisma.user.create({
            data: {
                phone: TEST_PHONE,
                email: syntheticAccountEmail(TEST_PHONE),
                name: '测试登录用户',
                plan: 'FREE',
                profileCompleted: true,
                ageConfirmedAt: new Date(),
                referralCode: `SNY-${randomBytes(4).toString('hex').toUpperCase()}`,
                ...consent,
            },
        });
    }
    return {
        id: user.id,
        name: user.name || '测试登录用户',
        email: user.email,
        phone: user.phone || TEST_PHONE,
        plan: user.plan,
        profileCompleted: true,
    };
}
