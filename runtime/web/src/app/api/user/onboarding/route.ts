// API: 用户引导数据保存
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { isCnEdition, readAgeConfirmed } from '@/lib/auth/age-confirmation';
import { recordSignupSource } from '@/lib/growth/signup-source';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const body = await req.json();
        const cn = isCnEdition();
        // 国内版未确认年龄：不写资料、不记积分、不发奖励。国际版保持原接口。
        if (cn && !readAgeConfirmed(body)) {
            return NextResponse.json({ error: '请先确认已年满 16 周岁' }, { status: 400 });
        }

        const { preferences } = body;
        const userId = (session.user as { id: string }).id;

        try {
            if (cn) {
                // 国内版奖励只发一次。profileCompleted 从 false 改成 true 的条件更新是领取凭证：
                // 并发请求里只有一行更新成功的那个请求写日志、加积分。
                const granted = await prisma.$transaction(async (tx) => {
                    const user = await tx.user.findUnique({
                        where: { id: userId },
                        select: { profileCompleted: true },
                    });
                    const existingLog = await tx.usageLog.findFirst({
                        where: { userId, type: 'ONBOARDING_COMPLETE' },
                        select: { id: true },
                    });
                    if (user?.profileCompleted === true || existingLog) return false;

                    const claimed = await tx.user.updateMany({
                        where: { id: userId, profileCompleted: false },
                        data: { profileCompleted: true, ageConfirmedAt: new Date() },
                    });
                    if (claimed.count !== 1) return false;

                    await tx.usageLog.create({
                        data: {
                            userId,
                            type: 'ONBOARDING_COMPLETE',
                            count: 1,
                            metadata: {
                                isPoints: true,
                                type: 'achievement',
                                description: '完成新用户引导',
                                points: 100,
                                preferences,
                            },
                        },
                    });
                    await tx.user.update({
                        where: { id: userId },
                        data: { points: { increment: 100 } },
                    });
                    return true;
                });

                if (!granted) {
                    // 已完成过引导：不再记来源（每个账号只在首次完成时记一次）
                    return NextResponse.json({
                        success: true,
                        message: '引导已完成',
                        rewards: { points: 0, aiCalls: 10, calculations: 5 },
                    });
                }
                // 注册来源题：只在首次完成引导时记一次，只收枚举代码；开关默认关闭。
                // 单独写、不放进 preferences（偏好会存进 usage_logs 的 metadata），失败不影响引导。
                await recordSignupSource(prisma, userId, body?.signupSource);
            } else {
                await prisma.user.update({
                    where: { id: userId },
                    data: { profileCompleted: true },
                });

                // 记录积分发放 (使用usageLog作为替代)
                await prisma.usageLog.create({
                    data: {
                        userId,
                        type: 'ONBOARDING_COMPLETE',
                        count: 1,
                        metadata: {
                            isPoints: true,
                            type: 'achievement',
                            description: '完成新用户引导',
                            points: 100,
                            preferences
                        }
                    }
                });

                // 增加用户积分
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        points: { increment: 100 }
                    }
                });
            }
        } catch (dbError) {
            console.error('Onboarding transaction failed:', dbError);
            return NextResponse.json({ error: '服务暂不可用，请稍后重试' }, { status: 503 });
        }

        return NextResponse.json({
            success: true,
            message: '引导完成，奖励已发放',
            rewards: {
                points: 100,
                aiCalls: 10,
                calculations: 5
            }
        });

    } catch (error) {
        console.error('Onboarding save error:', error);
        return NextResponse.json({ error: '保存失败' }, { status: 500 });
    }
}
