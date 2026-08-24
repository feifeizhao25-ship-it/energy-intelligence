'use client';

import { SessionProvider } from "next-auth/react";

/**
 * configured=false（NEXTAUTH_URL/NEXTAUTH_SECRET 缺失）时以空会话挂载：
 * SessionProvider 收到显式 session 后不会再请求 /api/auth/session，
 * 页面不再刷 CLIENT_FETCH_ERROR；useSession 调用方得到 unauthenticated。
 */
export default function AuthProvider({
    children,
    configured = true,
}: {
    children: React.ReactNode;
    configured?: boolean;
}) {
    if (!configured) {
        return (
            <SessionProvider session={null} refetchOnWindowFocus={false}>
                {children}
            </SessionProvider>
        );
    }
    return <SessionProvider>{children}</SessionProvider>;
}
