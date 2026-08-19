import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            plan?: string;
            phone?: string;
            profileCompleted?: boolean;
            limits?: any;
            lastResetAt?: Date;
        } & DefaultSession["user"];
    }

    interface User {
        id: string;
        plan?: string;
        phone?: string;
        profileCompleted?: boolean;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        plan?: string;
        phone?: string;
        profileCompleted?: boolean;
    }
}
