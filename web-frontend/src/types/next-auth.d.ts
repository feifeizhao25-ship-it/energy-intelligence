import NextAuth, { DefaultSession } from "next-auth";
import { Plan } from "@prisma/client";

declare module "next-auth" {
    interface User {
        id: string;
        phone?: string;
        plan: Plan;
        profileCompleted: boolean;
    }

    interface Session {
        user: {
            id: string;
            phone?: string;
            plan: Plan;
            profileCompleted: boolean;
        } & DefaultSession["user"];
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        phone?: string;
        plan: Plan;
        profileCompleted: boolean;
    }
}
