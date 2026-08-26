export interface IntentResult {
    category: string;
    confidence: number;
    keywords: string[];
    suggestedAgentId?: string;
}

const intentRules: {
    keywords: string[];
    category: string;
    agentId: string;
}[] = [
        {
            keywords: [
                "distribute", "distribution", "post", "publish", "share content",
                "social media", "分发", "发布", "推广", "宣传", "投放",
            ],
            category: "distribution",
            agentId: "futurex.distribution",
        },
        {
            keywords: [
                "energy", "solar", "battery", "power", "electricity", "renewable",
                "新能源", "太阳能", "电池", "充电", "光伏", "风能",
            ],
            category: "energy",
            agentId: "futurex.energy",
        },
        {
            keywords: [
                "health", "wellness", "exercise", "diet", "sleep", "meditation",
                "顺时", "养生", "健康", "运动", "饮食", "睡眠", "冥想",
            ],
            category: "health",
            agentId: "futurex.shunshi",
        },
        {
            keywords: [
                "schedule", "task", "remind", "calendar", "plan",
                "计划", "提醒", "日程", "安排",
            ],
            category: "automation",
            agentId: "",
        },
    ];

export function analyzeIntent(message: string): IntentResult {
    const lowerMessage = message.toLowerCase();
    let bestMatch: IntentResult = {
        category: "general",
        confidence: 0,
        keywords: [],
    };

    for (const rule of intentRules) {
        const matchedKeywords = rule.keywords.filter((kw) =>
            lowerMessage.includes(kw.toLowerCase())
        );

        const confidence = matchedKeywords.length / rule.keywords.length;

        if (confidence > bestMatch.confidence) {
            bestMatch = {
                category: rule.category,
                confidence,
                keywords: matchedKeywords,
                suggestedAgentId: rule.agentId || undefined,
            };
        }
    }

    // At minimum, return something if no specific match
    if (bestMatch.confidence === 0) {
        bestMatch.confidence = 0.1;
    }

    return bestMatch;
}
