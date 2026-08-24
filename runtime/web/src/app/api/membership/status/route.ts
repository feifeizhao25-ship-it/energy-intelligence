import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { PLANS } from '@/lib/auth/config';
import { PLAN_DETAILS } from '@/lib/membership/plans';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        planExpireAt: true,
        subscription: {
          select: {
            status: true,
            endDate: true,
            autoRenew: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    const currentPlan = PLANS[user.plan as keyof typeof PLANS];
    const planDetails = PLAN_DETAILS[user.plan as keyof typeof PLAN_DETAILS] || PLAN_DETAILS.FREE;
    const prices = {
      currency: 'CNY',
      monthly: planDetails.monthlyPrice,
      yearly: planDetails.yearlyPrice,
      unit: 'yuan',
    };

    return NextResponse.json({
      success: true,
      membership: {
        plan: user.plan,
        planName: currentPlan?.name || '免费版',
        planExpireAt: user.planExpireAt,
        subscriptionStatus: user.subscription?.status,
        subscriptionExpireAt: user.subscription?.endDate,
        autoRenew: user.subscription?.autoRenew,
        prices,
        limits: currentPlan,
        features: [
          'AI智能对话（' + (currentPlan?.aiCalls === -1 ? '无限' : currentPlan?.aiCalls + '次/天') + '）',
          '资源数据查询（' + (currentPlan?.resourceQueries === -1 ? '无限' : currentPlan?.resourceQueries + '次/天') + '）',
          '项目计算（' + (currentPlan?.calculations === -1 ? '无限' : currentPlan?.calculations + '次/天') + '）',
          '文献检索（' + (currentPlan?.paperSearches === -1 ? '无限' : currentPlan?.paperSearches + '次/天') + '）',
          '运维诊断（' + (currentPlan?.diagnoses === -1 ? '无限' : currentPlan?.diagnoses + '次/天') + '）',
          '专业报告生成',
          '优先技术支持',
        ],
      },
    });
  } catch (error) {
    console.error('获取会员状态错误:', error);
    return NextResponse.json(
      { error: '获取会员状态失败' },
      { status: 500 }
    );
  }
}
