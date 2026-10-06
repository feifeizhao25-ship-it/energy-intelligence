import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth-options";
import { isAuthConfigured, missingAuthConfig } from "@/lib/auth/availability";

const handler = NextAuth(authOptions);

function notConfigured() {
    // fail-closed：登录配置缺失时明确 503，不再让 next-auth 抛 NO_SECRET / 跳转全英文 Configuration 错误页。
    // 缺哪几项只写服务端日志，不回给浏览器（不向用户暴露环境变量名）。
    console.error('[auth] login is not configured; missing:', missingAuthConfig().join(', '));
    return NextResponse.json(
        {
            configured: false,
            error: "auth_not_configured",
            message: "登录服务维护中，请稍后再试",
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
