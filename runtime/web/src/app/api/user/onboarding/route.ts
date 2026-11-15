// API: 用户引导数据保存
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { readAgeConfirmed } from '@/lib/auth/age-confirmation';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const body = await req.json();
        // 未确认年龄：不写资料、不记积分、不发奖励。
        if (!readAgeConfirmed(body)) {
            return NextResponse.json({ error: '请先确认已年满 16 周岁' }, { status: 400 });
        }

        const { preferences } = body;
        const userId = (session.user as { id: string }).id;

        try {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    profileCompleted: true,
                    ageConfirmedAt: new Date(),
                }
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
