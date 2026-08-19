import prisma from "./db";

export interface AgentSearchResult {
    id: string;
    agentId: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    status: string;
    installCount: number;
    runCount: number;
    trendingScore: number;
    ratingAvg: number;
}

export async function searchAgents(
    query?: string,
    category?: string,
    limit: number = 20
): Promise<AgentSearchResult[]> {
    const where: Record<string, unknown> = {
        status: "active",
        visibility: "public",
    };

    if (category && category !== "all") {
        where.category = category;
    }

    const agents = await prisma.agent.findMany({
        where,
        include: {
            stats: true,
        },
        take: limit,
        orderBy: { createdAt: "desc" },
    });

    let results: AgentSearchResult[] = agents.map((agent) => ({
        id: agent.id,
        agentId: agent.agentId,
        name: agent.name,
        description: agent.description,
        icon: agent.icon,
        category: agent.category,
        status: agent.status,
        installCount: agent.stats?.installCount || 0,
        runCount: agent.stats?.runCount || 0,
        trendingScore: agent.stats?.trendingScore || 0,
        ratingAvg: agent.stats?.ratingAvg || 0,
    }));

    // Filter by query (simple text matching for MVP)
    if (query) {
        const lowerQuery = query.toLowerCase();
        results = results.filter(
            (a) =>
                a.name.toLowerCase().includes(lowerQuery) ||
                a.description.toLowerCase().includes(lowerQuery) ||
                a.category.toLowerCase().includes(lowerQuery) ||
                a.agentId.toLowerCase().includes(lowerQuery)
        );
    }

    return results;
}

export async function getAgentByAgentId(agentId: string) {
    return prisma.agent.findUnique({
        where: { agentId },
        include: {
            stats: true,
            creator: { include: { profile: true } },
        },
    });
}
