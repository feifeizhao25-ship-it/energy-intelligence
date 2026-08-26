import { PrismaClient } from "@prisma/client";

// Dual database router for CN / GLOBAL regions
// In MVP, both point to the same SQLite database
// In production, configure DATABASE_URL_CN and DATABASE_URL_GLOBAL for PostgreSQL

const globalForDbRouter = globalThis as unknown as {
    prismaCN: PrismaClient | undefined;
    prismaGLOBAL: PrismaClient | undefined;
};

function createClient(url?: string): PrismaClient {
    return new PrismaClient({
        datasourceUrl: url || process.env.DATABASE_URL,
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
}

export function getDb(region: string = "GLOBAL"): PrismaClient {
    if (region === "CN") {
        if (!globalForDbRouter.prismaCN) {
            globalForDbRouter.prismaCN = createClient(
                process.env.DATABASE_URL_CN || process.env.DATABASE_URL
            );
        }
        return globalForDbRouter.prismaCN;
    }

    if (!globalForDbRouter.prismaGLOBAL) {
        globalForDbRouter.prismaGLOBAL = createClient(
            process.env.DATABASE_URL_GLOBAL || process.env.DATABASE_URL
        );
    }
    return globalForDbRouter.prismaGLOBAL;
}

export type Region = "CN" | "GLOBAL";
