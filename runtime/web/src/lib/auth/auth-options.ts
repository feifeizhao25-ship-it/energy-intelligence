import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifySmsCode } from "./sms-verify";
import { prismaCodeStore } from "./sms-store";
import { consentRecord, CONSENT_REQUIRED_MESSAGE } from "@/lib/legal/consent";
import { refreshToken, type AppToken, type DbUser } from "./token-refresh";

function loadDbUser(id: string): Promise<DbUser | null> {
    // 已注销的账号视为不存在：会话在下一次刷新时失效
    return prisma.user.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, name: true, email: true, phone: true, plan: true, planExpireAt: true, profileCompleted: true },
    });
}

/**
 * 手机号 + 短信验证码登录；首次登录即注册。
 *
 * 登录必须明确同意《服务条款》和《隐私政策》（页面上的勾选框会传 consent=true），
 * 同意时间与文本版本记在用户行上，作为同意凭证。原来既没有勾选，也没有记录。
 */
export async function authorizeSms(credentials: Record<string, string> | undefined) {
    const phone = String(credentials?.phone || '').trim();
    const code = String(credentials?.code || '').trim();
    if (!phone || !code) throw new Error("请提供手机号和验证码");
    if (String(credentials?.consent || '') !== 'true') throw new Error(CONSENT_REQUIRED_MESSAGE);

    const result = await verifySmsCode(prismaCodeStore, phone, code);
    if (!result.ok) throw new Error(result.reason);

    const consent = consentRecord();
    let user = await prisma.user.findFirst({ where: { phone, deletedAt: null } });
    if (!user) {
        user = await prisma.user.create({
            data: {
                phone,
                email: `${phone}@xinnengyuan.ai`,
                name: `用户_${phone.slice(-4)}`,
                plan: 'FREE',
                referralCode: `SNY-${randomBytes(4).toString('hex').toUpperCase()}`,
                ...consent,
            }
        });
    } else if (user.termsVersion !== consent.termsVersion) {
        // 老用户首次在新版条款下登录：补记同意
        user = await prisma.user.update({ where: { id: user.id }, data: consent });
    }
    return {
        id: user.id,
        name: user.name || '',
        email: user.email,
        phone: user.phone || '',
        plan: user.plan,
        profileCompleted: user.profileCompleted
    };
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            id: "sms",
            name: "SMS Code",
            credentials: {
                phone: { label: "Phone", type: "text" },
                code: { label: "Code", type: "text" },
                consent: { label: "Consent", type: "text" },
            },
            async authorize(credentials) {
                return authorizeSms(credentials);
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, trigger }) {
            // 客户端 update() 传来的内容一律不采信，只重新读库（见 token-refresh.ts）。
            const next = await refreshToken(token as AppToken, { userId: user?.id, trigger }, loadDbUser);
            if (!next) return {} as typeof token;
            return next as typeof token;
        },
        async session({ session, token }) {
            if (token?.id && session.user) {
                session.user.id = token.id;
                session.user.plan = token.plan;
                session.user.phone = token.phone;
                session.user.profileCompleted = token.profileCompleted;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
        error: "/auth/error", // 中文错误页，替代默认全英文 /api/auth/error
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60,
    },
    secret: process.env.NEXTAUTH_SECRET,
};
