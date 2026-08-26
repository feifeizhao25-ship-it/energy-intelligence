import type { AgentSearchResult } from "./agentSearch";

interface RankOptions {
    preferredCategory?: string;
    userInstalledAgentIds?: string[];
}

export function rankAgents(
    agents: AgentSearchResult[],
    options: RankOptions = {}
): AgentSearchResult[] {
    const scored = agents.map((agent) => {
        let score = 0;

        // Category match bonus
        if (
            options.preferredCategory &&
            agent.category === options.preferredCategory
        ) {
            score += 50;
        }

        // Popularity score
        score += Math.min(agent.installCount * 2, 30);

        // Trending score
        score += Math.min(agent.trendingScore * 10, 20);

        // Rating bonus
        score += agent.ratingAvg * 5;

        // Already installed penalty (prefer new agents)
        if (options.userInstalledAgentIds?.includes(agent.agentId)) {
            score -= 10;
        }

        return { agent, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.agent);
}

// Calculate trending score based on recent activity
export function calculateTrendingScore(
    installCount: number,
    runCount: number,
    recentInstalls: number = 0,
    daysSinceCreated: number = 1
): number {
    const recency = Math.max(1, 30 - daysSinceCreated) / 30;
    const popularity = Math.log10(installCount + 1) * 0.3;
    const usage = Math.log10(runCount + 1) * 0.2;
    const momentum = recentInstalls * 0.3;

    return Number((recency * 0.2 + popularity + usage + momentum).toFixed(2));
}
