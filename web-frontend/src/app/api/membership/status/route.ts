import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { PLANS } from '@/lib/auth/config';

// 会员方案价格配置（分）
const PLAN_PRICES = {
  FREE: { price: 0, period: '永久' },
  PRO: { price: 9900, period: '月', yearlyPrice: 99000 },
  MAINTENANCE: { price: 19900, period: '月', yearlyPrice: 199000 },
  FULL: { price: 29900, period: '月', yearlyPrice: 299000 },
  TEAM: { price: 49900, period: '月', yearlyPrice: 499000 },
  ENTERPRISE: { price: 99900, period: '月', yearlyPrice: 999000 },
};

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
            expireAt: true,
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
    const prices = PLAN_PRICES[user.plan as keyof typeof PLAN_PRICES];

    return NextResponse.json({
      success: true,
      membership: {
        plan: user.plan,
        planName: currentPlan?.name || '免费版',
        planExpireAt: user.planExpireAt,
        subscriptionStatus: user.subscription?.status,
        subscriptionExpireAt: user.subscription?.expireAt,
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
