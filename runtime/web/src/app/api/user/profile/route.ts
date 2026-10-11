import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * 个人资料。按会话里的用户 ID 读写（原来按 email：短信登录的会话可能没有 email，查询直接报错 500）；
 * 只返回资料字段（原来保存后把整条用户记录回给浏览器，含密码哈希等字段）。
 */
const PROFILE_FIELDS = {
    name: true, email: true, phone: true, company: true, jobTitle: true, industry: true, bio: true, profileCompleted: true, plan: true,
} as const;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    try {
        const data = await req.json().catch(() => ({}));
        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                name: text(data?.name, 50),
                company: text(data?.company, 100),
                jobTitle: text(data?.jobTitle, 50),
                industry: text(data?.industry, 50),
                bio: text(data?.bio, 1000),
                profileCompleted: true,
            },
            select: PROFILE_FIELDS,
        });

        return NextResponse.json({ success: true, user });
    } catch (error: unknown) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: "服务器内部错误，请稍后再试" }, { status: 500 });
    }
}

export async function GET() {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: PROFILE_FIELDS });
        return NextResponse.json({ success: true, user });
    } catch {
        return NextResponse.json({ error: "服务器内部错误，请稍后再试" }, { status: 500 });
    }
}
