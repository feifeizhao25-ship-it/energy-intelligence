import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { effectivePlan } from '@/lib/auth/token-refresh';
import { USAGE_LIMITS } from './plans';

/**
 * 「保存类」额度（项目数、收藏文献数……）的服务端校验。
 *
 * 原来只有电站数（POST /api/projects/[id]/stations）真正校验；会员页写着
 * 「免费版 1 个项目、5 篇收藏文献」，但 POST /api/projects、收藏文献、上传文献
 * 都不查，免费用户想存多少存多少，付费档的数量差异形同虚设。
 *
 * 计数 + 创建不在同一事务里：极端并发下可能多出一两条，这里选择不为此上串行锁。
 */

export type StorageKind = 'projects' | 'saved_papers' | 'stations' | 'folders' | 'saved_locations';

const LABEL: Record<StorageKind, string> = {
  projects: '项目', saved_papers: '收藏文献', stations: '电站', folders: '文献夹', saved_locations: '收藏地点',
};

export interface StorageDeps {
  loadPlan(userId: string): Promise<{ plan: string; planExpireAt: Date | null } | null>;
  count(userId: string, kind: StorageKind): Promise<number>;
}

export const prismaStorageDeps: StorageDeps = {
  loadPlan: (userId) => prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { plan: true, planExpireAt: true } }),
  count: (userId, kind) => {
    switch (kind) {
      case 'projects': return prisma.project.count({ where: { userId } });
      case 'saved_papers': return prisma.savedPaper.count({ where: { userId } });
      case 'stations': return prisma.station.count({ where: { userId } });
      case 'folders': return prisma.paperFolder.count({ where: { userId } });
      case 'saved_locations': return prisma.savedLocation.count({ where: { userId } });
    }
  },
};

/** 返回 null 表示还有空位；否则返回应直接 return 的 403 响应。 */
export async function enforceStorageLimit(
  userId: string,
  kind: StorageKind,
  deps: StorageDeps = prismaStorageDeps,
  now = new Date(),
): Promise<NextResponse | null> {
  const user = await deps.loadPlan(userId);
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
  const plan = effectivePlan(user.plan, user.planExpireAt, now) as keyof typeof USAGE_LIMITS;
  const limit = (USAGE_LIMITS[plan] ?? USAGE_LIMITS.FREE)[kind];
  if (limit === Infinity) return null;
  const used = await deps.count(userId, kind);
  if (used < limit) return null;
  return NextResponse.json(
    {
      error: 'STORAGE_LIMIT_EXCEEDED',
      message: limit > 0
        ? `${LABEL[kind]}数量已达当前会员档上限（${limit}），请升级会员或删除不用的${LABEL[kind]}`
        : `当前会员档不含${LABEL[kind]}功能，请升级会员`,
      limit,
      used,
      currentPlan: plan,
    },
    { status: 403 },
  );
}
