import { cookies } from "next/headers";
import prisma from "./db";

export interface SessionUser {
    id: string;
    email: string;
    name: string;
    region: string;
    role: string;
    username?: string;
    avatar?: string;
}

const DEMO_USER_ID = "demo-user-001";

// Get current user from session cookie (mock auth for MVP)
export async function getCurrentUser(): Promise<SessionUser | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("futurex-session");

    // For MVP, auto-login as demo user
    const userId = sessionCookie?.value || DEMO_USER_ID;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });

        if (!user) return null;

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            region: user.region,
            role: user.role,
            username: user.profile?.username,
            avatar: user.profile?.avatar,
        };
    } catch {
        return null;
    }
}

// Set session cookie
export async function setSession(userId: string) {
    const cookieStore = await cookies();
    cookieStore.set("futurex-session", userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
    });
}

// Clear session
export async function clearSession() {
    const cookieStore = await cookies();
    cookieStore.delete("futurex-session");
}
