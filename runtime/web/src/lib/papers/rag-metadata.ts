export type RagMetadata = {
    title?: unknown;
    userId?: unknown;
    sourceUrl?: unknown;
    retrievedAt?: unknown;
    sourcePublishedAt?: unknown;
    [key: string]: unknown;
};

export type RagFreshness = {
    retrievedAt: string;
    ageDays: number;
    maxAgeDays: number;
    status: 'current';
};

const DAY_MS = 86_400_000;

export function ragMaxAgeDays(raw = process.env.RAG_MAX_RETRIEVAL_AGE_DAYS): number {
    if (!raw) return 30;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 3650) {
        throw new Error('RAG_MAX_RETRIEVAL_AGE_DAYS 必须是 1 到 3650 之间的整数');
    }
    return value;
}

function parseDate(value: unknown, field: string): Date {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`RAG 来源元数据缺失: ${field}`);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error(`RAG 来源日期无效: ${field}`);
    return parsed;
}

export function validateRagMetadata(
    metadata: RagMetadata,
    now = new Date(),
    maxAgeDays = ragMaxAgeDays(),
): RagFreshness {
    for (const key of ['title', 'userId', 'sourceUrl'] as const) {
        if (typeof metadata?.[key] !== 'string' || !metadata[key].trim()) {
            throw new Error(`RAG 来源元数据缺失: ${key}`);
        }
    }
    let source: URL;
    try {
        source = new URL(String(metadata.sourceUrl));
    } catch {
        throw new Error('RAG 来源 URL 无效');
    }
    if (source.protocol !== 'https:' || !source.hostname) throw new Error('RAG 来源必须使用 HTTPS');

    const retrieved = parseDate(metadata.retrievedAt, 'retrievedAt');
    const ageMs = now.getTime() - retrieved.getTime();
    if (ageMs < -5 * 60_000) throw new Error('RAG 检索时间不能晚于当前时间');
    const ageDays = Math.max(0, ageMs / DAY_MS);
    if (ageDays > maxAgeDays) {
        throw new Error(`RAG 来源已过期：检索时间超过 ${maxAgeDays} 天，请重新抓取并验证`);
    }

    if (metadata.sourcePublishedAt != null) {
        const published = parseDate(metadata.sourcePublishedAt, 'sourcePublishedAt');
        if (published.getTime() > now.getTime() + 5 * 60_000) {
            throw new Error('RAG 来源发布时间不能晚于当前时间');
        }
    }

    return {
        retrievedAt: retrieved.toISOString(),
        ageDays: Number(ageDays.toFixed(2)),
        maxAgeDays,
        status: 'current',
    };
}
