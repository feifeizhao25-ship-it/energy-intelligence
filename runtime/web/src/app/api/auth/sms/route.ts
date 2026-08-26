import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationCode, generateCode } from "@/lib/sms/aliyun";

import { rateLimit, getRateLimitResponse } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
    try {
        // 0. API 限流保护 (单IP 每分钟限制3次)
        const ip = req.headers.get("x-forwarded-for") || "unknown";
        const limiter = rateLimit(ip, 3);
        if (limiter.isLimited) {
            return getRateLimitResponse();
        }

        const { phone } = await req.json();

        if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
            return NextResponse.json({ success: false, error: "请输入有效的手机号" }, { status: 400 });
        }

        // 1. 频率限制 (例如 60秒内只能发一次)
        const lastCode = await prisma.verificationCode.findFirst({
            where: {
                phone,
                createdAt: { gt: new Date(Date.now() - 60000) },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (lastCode) {
            return NextResponse.json({ success: false, error: "发送频繁，请 60 秒后再试" }, { status: 429 });
        }

        // 2. 生成验证码
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 10 * 60000); // 10 分钟有效

        // 3. 保存到数据库
        await prisma.verificationCode.create({
            data: { phone, code, expiresAt },
        });

        // 4. 发送短信
        const result = await sendVerificationCode(phone, code);

        if (result.success) {
            return NextResponse.json({ success: true, message: "验证码已发送" });
        } else {
            return NextResponse.json({ success: false, error: result.error || "发送失败" }, { status: 500 });
        }
    } catch (error: any) {
        console.error('SMS API Error:', error);
        return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
    }
}
