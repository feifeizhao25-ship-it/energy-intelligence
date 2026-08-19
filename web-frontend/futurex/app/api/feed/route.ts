import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const sort = url.searchParams.get("sort") || "trending";
        const category = url.searchParams.get("category");
        const query = url.searchParams.get("q");

        const where: Record<string, unknown> = {
            status: "active",
            visibility: "public",
        };

        if (category && category !== "all") {
            where.category = category;
        }

        let orderBy: Record<string, unknown>[] = [];

        switch (sort) {
            case "trending":
                orderBy = [{ stats: { trendingScore: "desc" } }];
                break;
            case "new":
                orderBy = [{ createdAt: "desc" }];
                break;
            case "popular":
                orderBy = [{ stats: { installCount: "desc" } }];
                break;
            default:
                orderBy = [{ createdAt: "desc" }];
        }

        const agents = await prisma.agent.findMany({
            where,
            include: { stats: true },
            orderBy,
            take: 20,
        });

        let results = agents.map((agent) => ({
            agentId: agent.agentId,
            name: agent.name,
            description: agent.description,
            icon: agent.icon,
            category: agent.category,
            installCount: agent.stats?.installCount || 0,
            runCount: agent.stats?.runCount || 0,
            ratingAvg: agent.stats?.ratingAvg || 0,
            trendingScore: agent.stats?.trendingScore || 0,
        }));

        // Text search filter
        if (query) {
            const lowerQ = query.toLowerCase();
            results = results.filter(
                (a) =>
                    a.name.toLowerCase().includes(lowerQ) ||
                    a.description.toLowerCase().includes(lowerQ)
            );
        }

        return NextResponse.json({ agents: results });
    } catch (error) {
        console.error("Feed error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
