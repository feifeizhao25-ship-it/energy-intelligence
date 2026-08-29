import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth-options";
import { isAuthConfigured, missingAuthConfig } from "@/lib/auth/availability";

const handler = NextAuth(authOptions);

function notConfigured() {
    // fail-closed：NEXTAUTH_URL / NEXTAUTH_SECRET 缺失时明确 503，
    // 不再让 next-auth 抛 NO_SECRET / 跳转全英文 Configuration 错误页
    return NextResponse.json(
        {
            configured: false,
            error: "auth_not_configured",
            missing: missingAuthConfig(),
            message: "登录服务未配置，请在部署环境中设置 NEXTAUTH_URL 与 NEXTAUTH_SECRET",
        },
        { status: 503 },
    );
}

export async function GET(req: Request, ctx: { params: Promise<{ nextauth: string[] }> }) {
    if (!isAuthConfigured()) return notConfigured();
    return handler(req, { params: await ctx.params });
}

export async function POST(req: Request, ctx: { params: Promise<{ nextauth: string[] }> }) {
    if (!isAuthConfigured()) return notConfigured();
    return handler(req, { params: await ctx.params });
}
