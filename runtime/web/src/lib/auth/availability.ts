/**
 * next-auth 配置可用性判定（fail-closed）。
 *
 * 生产环境必须同时配置 NEXTAUTH_URL 与 NEXTAUTH_SECRET；缺失时：
 * - /api/auth/* 返回 503 { configured: false }（见 [...nextauth]/route.ts）
 * - 前端 SessionProvider 以空会话挂载，不再轮询报错的 session 接口
 * - 登录页展示「登录服务未配置」中文提示并禁用表单
 *
 * 开发环境只要求 NEXTAUTH_SECRET（next-auth 可自动推断本地 URL），
 * 禁止在任何环境中硬编码 localhost 作为 NEXTAUTH_URL 兜底。
 */
export function isAuthConfigured(): boolean {
    if (!process.env.NEXTAUTH_SECRET) return false;
    if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL) return false;
    return true;
}

/** 缺失的配置项列表（用于 503 响应与日志）。 */
export function missingAuthConfig(): string[] {
    const missing: string[] = [];
    if (!process.env.NEXTAUTH_SECRET) missing.push('NEXTAUTH_SECRET');
    if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL) missing.push('NEXTAUTH_URL');
    return missing;
}
