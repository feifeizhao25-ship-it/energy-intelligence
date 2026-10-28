import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface ImprovementProposal {
    id?: string;
    created_at?: string;
    status?: string;
    applied?: boolean;
    live?: boolean;
    approval_note?: string;
    suggestions?: string[];
    metrics?: { recall_at_8?: number | null; previous_recall_at_8?: number | null; recall_delta?: number | null };
    approval?: { submitted?: boolean; reason?: string };
    candidates?: { kind?: string; name?: string; url?: string; license?: string; note?: string }[];
    display_audit?: { status?: string; reason?: string; issueCounts?: Record<string, number> };
    ingestion?: { buckets?: { status?: string; bucket?: string; reason?: string }[] };
}

export function queueFile(): string {
    const dir = process.env.NENGJIAN_IMPROVEMENT_DIR
        || path.join(process.cwd(), '..', 'backend', 'data', 'improvement');
    return path.join(dir, 'proposals.jsonl');
}

export function readProposals(): ImprovementProposal[] {
    const file = queueFile();
    if (!existsSync(file)) return [];
    const rows: ImprovementProposal[] = [];
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const text = line.trim();
        if (!text) continue;
        try {
            const item = JSON.parse(text) as ImprovementProposal;
            if (item && typeof item === 'object') rows.push(item);
        } catch {
            continue;
        }
    }
    return rows;
}
