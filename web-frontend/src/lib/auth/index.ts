import { getServerSession } from 'next-auth';
import { authOptions, PLANS } from './config';
import { prisma } from '@/lib/prisma';

// 获取当前用户会话
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

// 获取用户完整信息
export async function getUserFullInfo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
      team: true,
    },
  });
  return user;
}

const FEATURE_MAP = {
  aiCalls: 'dailyAiCalls',
  resourceQueries: 'dailyResourceQueries',
  calculations: 'dailyCalculations',
  paperSearches: 'dailyPaperSearches',
  diagnoses: 'dailyDiagnoses'
} as const;

// 检查功能限制
export async function checkFeatureLimit(
  userId: string,
  feature: 'aiCalls' | 'resourceQueries' | 'calculations' | 'paperSearches' | 'diagnoses'
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      dailyAiCalls: true,
      dailyResourceQueries: true,
      dailyCalculations: true,
      dailyPaperSearches: true,
      dailyDiagnoses: true,
      lastResetAt: true,
    },
  });

  if (!user) {
    return { allowed: false, error: '用户不存在' };
  }

  // 检查是否需要重置每日计数
  const now = new Date();
  const lastReset = new Date(user.lastResetAt);
  const isNewDay = now.toDateString() !== lastReset.toDateString();

  if (isNewDay) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyAiCalls: 0,
        dailyResourceQueries: 0,
        dailyCalculations: 0,
        dailyPaperSearches: 0,
        dailyDiagnoses: 0,
        lastResetAt: now,
      },
    });
    return { allowed: true, remaining: -1, reset: true };
  }

  const planLimits = PLANS[user.plan as keyof typeof PLANS] || PLANS.FREE;
  const limit = planLimits[feature];
  const dbField = FEATURE_MAP[feature];
  const current = user[dbField];

  if (limit === -1) {
    return { allowed: true, remaining: -1 };
  }

  const remaining = limit - current;
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    limit,
    current,
  };
}

// 增加功能使用计数
export async function incrementUsage(
  userId: string,
  feature: 'aiCalls' | 'resourceQueries' | 'calculations' | 'paperSearches' | 'diagnoses'
) {
  const dbField = FEATURE_MAP[feature];
  await prisma.user.update({
    where: { id: userId },
    data: {
      [dbField]: { increment: 1 },
    },
  });
}

// 获取用户当前使用统计
export async function getUserUsageStats(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      dailyAiCalls: true,
      dailyResourceQueries: true,
      dailyCalculations: true,
      dailyPaperSearches: true,
      dailyDiagnoses: true,
      lastResetAt: true,
    },
  });

  if (!user) return null;

  const planLimits = PLANS[user.plan as keyof typeof PLANS] || PLANS.FREE;

  return {
    plan: user.plan,
    limits: {
      aiCalls: planLimits.aiCalls,
      resourceQueries: planLimits.resourceQueries,
      calculations: planLimits.calculations,
      paperSearches: planLimits.paperSearches,
      diagnoses: planLimits.diagnoses,
    },
    usage: {
      aiCalls: user.dailyAiCalls,
      resourceQueries: user.dailyResourceQueries,
      calculations: user.dailyCalculations,
      paperSearches: user.dailyPaperSearches,
      diagnoses: user.dailyDiagnoses,
    },
    lastResetAt: user.lastResetAt,
  };
}

// 验证用户是否为付费会员
export async function isPaidUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  if (!user) return false;
  return user.plan !== 'FREE';
}
