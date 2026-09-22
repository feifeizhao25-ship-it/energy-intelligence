import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifySmsCode, type CodeStore } from "./sms-verify";
import { refreshToken, type AppToken, type DbUser } from "./token-refresh";

const prismaCodeStore: CodeStore = {
    latestActive: (phone, now) => prisma.verificationCode.findFirst({
        where: { phone, used: false, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
    }),
    recordFailure: async (id, attempts, exhausted) => {
        await prisma.verificationCode.update({ where: { id }, data: { attempts, ...(exhausted ? { used: true } : {}) } });
    },
    consume: async (id) => {
        const { count } = await prisma.verificationCode.updateMany({ where: { id, used: false }, data: { used: true } });
        return count === 1;
    },
};

function loadDbUser(id: string): Promise<DbUser | null> {
    return prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, phone: true, plan: true, planExpireAt: true, profileCompleted: true },
    });
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            id: "sms",
            name: "SMS Code",
            credentials: {
                phone: { label: "Phone", type: "text" },
                code: { label: "Code", type: "text" },
            },
            async authorize(credentials) {
                const phone = String(credentials?.phone || '').trim();
                const code = String(credentials?.code || '').trim();
                if (!phone || !code) throw new Error("请提供手机号和验证码");

                const result = await verifySmsCode(prismaCodeStore, phone, code);
                if (!result.ok) throw new Error(result.reason);

                let user = await prisma.user.findFirst({ where: { phone } });
                if (!user) {
                    user = await prisma.user.create({
                        data: {
                            phone,
                            email: `${phone}@xinnengyuan.ai`,
                            name: `用户_${phone.slice(-4)}`,
                            plan: 'FREE',
                            referralCode: `SNY-${randomBytes(4).toString('hex').toUpperCase()}`,
                        }
                    });
                }
                return {
                    id: user.id,
                    name: user.name || '',
                    email: user.email,
                    phone: user.phone || '',
                    plan: user.plan,
                    profileCompleted: user.profileCompleted
                };
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
