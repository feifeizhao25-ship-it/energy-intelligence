import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

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
                console.log('--- Auth Attempt ---', credentials?.phone);

                // 1. 🚀 超级测试账号硬编码逻辑 (防止数据库连接失败阻碍演示)
                if (credentials?.phone === '13888888888' && credentials?.code === '123456') {
                    console.log('Auth Success: Master Account bypassing DB');
                    return {
                        id: 'dev-master-id',
                        name: '超级测试员',
                        email: 'test@xinnengyuan.ai',
                        phone: '13888888888',
                        plan: 'ENTERPRISE',
                        profileCompleted: true
                    };
                }

                if (!credentials?.phone || !credentials?.code) {
                    throw new Error("请提供手机号和验证码");
                }

                try {
                    // 2. 正常逻辑：验证数据库验证码 (用于其他手机号测试)
                    const verification = await prisma.verificationCode.findFirst({
                        where: {
                            phone: credentials.phone,
                            code: credentials.code,
                            used: false,
                            expiresAt: { gt: new Date() },
                        },
                        orderBy: { createdAt: 'desc' },
                    });

                    if (!verification) {
                        throw new Error("验证码无效或已过期");
                    }

                    // 标记验证码已使用
                    await prisma.verificationCode.update({
                        where: { id: verification.id },
                        data: { used: true },
                    });

                    // 3. 查找或创建用户
                    let user = await prisma.user.findFirst({
                        where: { phone: credentials.phone }
                    });

                    if (!user) {
                        const selfReferralCode = `SNY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                        user = await prisma.user.create({
                            data: {
                                phone: credentials.phone,
                                email: `${credentials.phone}@xinnengyuan.ai`,
                                name: `用户_${credentials.phone.slice(-4)}`,
                                plan: 'FREE',
                                referralCode: selfReferralCode,
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
                } catch (error: any) {
                    console.error('Core Auth Error:', error.message);
                    // 演示目的：如果数据库挂了但不是测试账号，报错友好提示
                    throw new Error(error.message || "身份验证暂时不可用");
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id;
                token.plan = user.plan;
                token.phone = user.phone;
                token.profileCompleted = user.profileCompleted;
            }
            if (trigger === "update" && session) {
                return { ...token, ...session.user };
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
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
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60,
    },
    secret: process.env.NEXTAUTH_SECRET,
};
