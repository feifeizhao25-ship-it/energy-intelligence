import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

/** 当前登录用户拥有的项目；未登录返回 'unauthenticated'，不是本人的返回 null。 */
export async function ownedProject(projectId: string): Promise<{ id: string; userId: string } | null | 'unauthenticated'> {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return 'unauthenticated';
    return prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true, userId: true } });
}
