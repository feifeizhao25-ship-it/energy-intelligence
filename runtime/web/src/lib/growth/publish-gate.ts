import { bottomLineTerms } from '@/lib/compliance/bottom-line';

export interface PublishDraft {
    title: string;
    sourceUrl: string;
    asOf: string;
    claims: string[];
}

/** 增长页草稿。缺来源、缺日期或还在审批时不能发布。 */
export function publishAllowed(draft: PublishDraft): { ok: boolean; reason: string } {
    if (!draft.title.trim() || !draft.sourceUrl.trim() || !draft.asOf.trim()) {
        return { ok: false, reason: '缺少标题、原文链接或截至日期' };
    }
    const banned = bottomLineTerms();
    if (draft.claims.some((line) => banned.some((term) => line.toLowerCase().includes(term.toLowerCase())))) {
        return { ok: false, reason: '文案越界' };
    }
    return { ok: false, reason: '待企业微信审批后才能发布' };
}
