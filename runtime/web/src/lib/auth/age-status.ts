/** 年龄确认查库失败时的提示。不写年龄确认，也不发引导积分。 */
export const AGE_LOOKUP_UNAVAILABLE_MESSAGE = '暂时无法确认账号状态，请稍后重试';

/** 独立页，避免查库失败时再把用户送回年龄勾选。 */
export const AGE_LOOKUP_UNAVAILABLE_PATH = '/onboarding/unavailable';

const AGE_RETRY_PATHS = new Set(['/dashboard', '/assistant']);

export function normalizePathname(pathname: string | null | undefined): string {
    if (!pathname) return '';
    const bare = pathname.split('?')[0]?.split('#')[0] || '';
    const stripped = bare.replace(/^\/(?:zh|en)(?=\/|$)/, '') || '/';
    if (stripped.length > 1 && stripped.endsWith('/')) return stripped.slice(0, -1);
    return stripped || '/';
}

/** 重试只回到工作台或助手。其它地址（包括站外链接）落到工作台。 */
export function safeAgeRetryPath(pathname: string | null | undefined): string {
    const path = normalizePathname(pathname);
    return AGE_RETRY_PATHS.has(path) ? path : '/dashboard';
}

export function ageLookupUnavailablePath(pathname?: string | null): string {
    return `${AGE_LOOKUP_UNAVAILABLE_PATH}?next=${encodeURIComponent(safeAgeRetryPath(pathname))}`;
}
