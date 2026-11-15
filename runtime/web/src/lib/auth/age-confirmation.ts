import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { isCnEdition } from '@/lib/ai/router';

export { isCnEdition };

/** 与 proxy.ts 写入的请求头一致，供服务端布局判断当前路径。 */
export const AGE_GATE_PATH_HEADER = 'x-nengjian-pathname';

export const AGE_CONFIRMATION_PATH = '/onboarding';

/** 构建期的动态渲染信号不能当成「查库失败」吞掉，否则会在构建时去连数据库。 */
function rethrowFrameworkError(error: unknown): void {
    if (!error || typeof error !== 'object') return;
    const record = error as { digest?: unknown; code?: unknown };
    const digest = typeof record.digest === 'string' ? record.digest : '';
    if (digest === 'DYNAMIC_SERVER_USAGE' || digest.startsWith('NEXT_')) throw error;
    if (record.code === 'NEXT_STATIC_GEN_BAILOUT') throw error;
}

const EXEMPT_PATHS = new Set(['/pricing', '/checkout']);

export type AgeConfirmationRow = {
    ageConfirmedAt?: Date | string | null;
    profileCompleted?: boolean | null;
};

/**
 * 已写入年龄确认，或上线前已经完成引导（profileCompleted）的用户，不再拦回引导页。
 * profileCompleted 是当时仅有的完成标记；新用户必须有 ageConfirmedAt。
 */
export function isAgeConfirmed(user: AgeConfirmationRow | null | undefined): boolean {
    if (!user) return false;
    if (user.ageConfirmedAt) return true;
    return user.profileCompleted === true;
}

export function normalizePathname(pathname: string | null | undefined): string {
    if (!pathname) return '';
    const bare = pathname.split('?')[0]?.split('#')[0] || '';
    const stripped = bare.replace(/^\/(?:zh|en)(?=\/|$)/, '') || '/';
    if (stripped.length > 1 && stripped.endsWith('/')) return stripped.slice(0, -1);
    return stripped || '/';
}

/** 价格与结账页保持原有公开转化路径，不在这里改道。 */
export function ageConfirmationExempt(pathname: string | null | undefined): boolean {
    return EXEMPT_PATHS.has(normalizePathname(pathname));
}

export function shouldRedirectForAge(input: {
    signedIn: boolean;
    pathname?: string | null;
    user: AgeConfirmationRow | null;
    lookupFailed?: boolean;
}): boolean {
    // 国际版（APP_EDITION / NEXT_PUBLIC_APP_EDITION 不是 cn）不走这条年龄门。
    if (!isCnEdition()) return false;
    if (!input.signedIn) return false;
    if (input.lookupFailed) return false;
    if (ageConfirmationExempt(input.pathname)) return false;
    return !isAgeConfirmed(input.user);
}

/** 请求体里的年龄确认必须是布尔 true。缺省、false 或其他类型都不算。 */
export function readAgeConfirmed(body: unknown): boolean {
    if (!body || typeof body !== 'object') return false;
    const record = body as Record<string, unknown>;
    const preferences = record.preferences;
    const hasTop = 'ageConfirmed' in record;
    const hasPref = !!preferences && typeof preferences === 'object' && 'ageConfirmed' in preferences;
    if (!hasTop && !hasPref) return false;
    const topOk = hasTop ? record.ageConfirmed === true : true;
    const prefOk = hasPref ? (preferences as Record<string, unknown>).ageConfirmed === true : true;
    return topOk && prefOk;
}

export async function enforceAgeConfirmation(): Promise<void> {
    if (!isCnEdition()) return;

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return;

    let pathname: string | null = null;
    try {
        const headerList = await headers();
        pathname = headerList.get(AGE_GATE_PATH_HEADER);
    } catch (error) {
        rethrowFrameworkError(error);
        pathname = null;
    }

    let user: AgeConfirmationRow | null = null;
    let lookupFailed = false;
    try {
        user = await prisma.user.findUnique({
            where: { id: userId },
            select: { ageConfirmedAt: true, profileCompleted: true },
        });
    } catch (error) {
        rethrowFrameworkError(error);
        lookupFailed = true;
    }

    if (shouldRedirectForAge({ signedIn: true, pathname, user, lookupFailed })) {
        redirect(AGE_CONFIRMATION_PATH);
    }
}
