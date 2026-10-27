import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationCode } from "@/lib/sms/aliyun";
import { generateSmsCode, DAILY_LIMIT_PER_PHONE, PHONE_PATTERN, CODE_TTL_MS, RESEND_INTERVAL_MS } from "@/lib/auth/sms-verify";

import { enforceRateLimit, PUBLIC_RULES } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
    try {
        // 0. 按来源限流：每条短信都花钱，也能被拿去轰炸别人。
        //    分钟级（防脚本连发）+ 小时级（防分散在不同分钟慢慢刷）；再往下还有按手机号的 60 秒 / 每日上限。
        const burst = await enforceRateLimit(req, PUBLIC_RULES.smsBurst);
        if (burst) return burst;
        const hourly = await enforceRateLimit(req, PUBLIC_RULES.smsHourly);
        if (hourly) return hourly;

        const { phone } = await req.json().catch(() => ({ phone: '' }));

        if (typeof phone !== 'string' || !PHONE_PATTERN.test(phone)) {
            return NextResponse.json({ success: false, error: "请输入有效的手机号" }, { status: 400 });
        }

        // 1. 频率限制 (例如 60秒内只能发一次)
        const lastCode = await prisma.verificationCode.findFirst({
            where: {
                phone,
                createdAt: { gt: new Date(Date.now() - RESEND_INTERVAL_MS) },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (lastCode) {
            return NextResponse.json({ success: false, error: "发送频繁，请 60 秒后再试" }, { status: 429 });
        }

        // 同一手机号每天最多发送 DAILY_LIMIT_PER_PHONE 条（短信按条计费，也防止拿来轰炸别人）
        const sentToday = await prisma.verificationCode.count({
            where: { phone, createdAt: { gt: new Date(Date.now() - 24 * 3600 * 1000) } },
        });
        if (sentToday >= DAILY_LIMIT_PER_PHONE) {
            return NextResponse.json({ success: false, error: "今日验证码发送次数已达上限，请明天再试" }, { status: 429 });
        }

        // 2. 生成验证码
        const code = generateSmsCode();
        const expiresAt = new Date(Date.now() + CODE_TTL_MS);

        // 3. 保存到数据库
        await prisma.verificationCode.create({
            data: { phone, code, expiresAt },
        });

        // 4. 发送短信
        const result = await sendVerificationCode(phone, code);

        if (result.success) {
            const reveal = process.env.NODE_ENV === 'development' && process.env.SMS_DEV_REVEAL === '1' && 'mock' in result && result.mock;
            return NextResponse.json({ success: true, message: "验证码已发送", ...(reveal ? { devCode: code } : {}) });
        } else {
            return NextResponse.json({ success: false, error: result.error || "发送失败" }, { status: 500 });
        }
    } catch (error: any) {
        console.error('SMS API Error:', error);
        return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
    }
}
