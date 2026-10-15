/**
 * 底线守卫：不做投资建议/收益承诺、不做价格预测、不冒充官方。
 * 禁词表与后端共用一份内容（bottom-line-terms.json）。
 */
import terms from './bottom-line-terms.json';

export type BottomLineCategory = 'investment_advice' | 'price_prediction' | 'impersonating_official';

export const BOTTOM_LINE_CATEGORIES: BottomLineCategory[] = ['investment_advice', 'price_prediction', 'impersonating_official'];

export function bottomLineTerms(category?: BottomLineCategory): string[] {
    const cats = category ? [category] : BOTTOM_LINE_CATEGORIES;
    return cats.flatMap(c => (terms as Record<string, unknown>)[c] as string[]);
}

/** 返回文本中命中的禁词（不区分英文大小写）。 */
export function findBottomLineViolations(text: string): string[] {
    const lower = text.toLowerCase();
    return bottomLineTerms().filter(t => lower.includes(t.toLowerCase()));
}

/** 标准拒答说明（中英各一）。 */
export const BOTTOM_LINE_NOTICE_ZH = '本平台只提供事实、数据、政策原文和可复核的计算，不提供投资建议、收益承诺或价格预测，也不代表任何政府或官方机构。';
export const BOTTOM_LINE_NOTICE_EN = 'This service provides facts, data, primary policy sources and verifiable calculations only. It does not give investment advice, return guarantees or price predictions, and does not speak for any government or official body.';
