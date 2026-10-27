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

const NEGATIONS = [
    '不构成投资建议',
    '不提供投资建议',
    '并非投资建议',
    '不是投资建议',
    '不作为投资建议',
    '不做投资建议',
    '不给投资建议',
    '不得用于投资决策',
    '不用于投资决策',
    '不是投资结论',
    'not investment advice',
    'do not give investment advice',
];

/** 不调用模型。只用于国内对话的输入/输出，源码扫描仍走精确词表。 */
const PARAPHRASE: Array<[RegExp, string]> = [
    [/推荐\s*投资/, '推荐投资'],
    [/暂缓\s*投资/, '暂缓投资'],
    [/强烈\s*推荐/, '强烈推荐'],
    [/值得\s*(投资|入手|买|配置|布局)/, '值得投资类'],
    [/(建议|推荐).{0,8}(买入|加仓|建仓|入手|配置|布局|投资)/, '建议买入类'],
    [/投资\s*建议/, '投资建议'],
    [/投资\s*结论/, '投资结论'],
    [/具备投资吸引力/, '投资吸引力'],
    [/回报可观/, '回报可观'],
    [/看涨|看跌/, '涨跌判断'],
    [/(预计|预测).{0,16}(电价|价格|硅料|组件价)/, '价格预测'],
    [/(电价|价格|硅料).{0,8}(将|会)(上涨|下跌|涨|跌)/, '价格涨跌'],
    [/会涨|会跌/, '涨跌判断'],
    [/(承诺|保证).{0,8}(收益|回报|年化)/, '收益承诺'],
    [/稳赚|保本|必赚|无风险收益|年化保底/, '收益承诺'],
    [/该不该投|能不能投|要不要投|值不值得投|可以投吗/, '投资询问'],
    [/官方发布|国家认证|政府推荐|官方认证/, '冒充官方'],
    [/recommend(?:ed)?\s+invest/i, 'recommend investing'],
    [/price\s+will\s+(?:rise|fall)/i, 'price forecast'],
    [/guaranteed\s+returns?/i, 'guaranteed return'],
];

function maskNegations(text: string): string {
    let masked = text || '';
    for (const phrase of NEGATIONS) masked = masked.split(phrase).join(' ');
    return masked;
}

export function findParaphraseViolations(text: string): string[] {
    const masked = maskNegations(text);
    const found: string[] = [];
    for (const [pattern, label] of PARAPHRASE) {
        if (pattern.test(masked) && !found.includes(label)) found.push(label);
        pattern.lastIndex = 0;
    }
    return found;
}

/** 国内文本：精确词或改写都命中时整段换成标准说明。 */
export function neutralizeCnText(text: string): string {
    if (findBottomLineViolations(text).length || findParaphraseViolations(text).length) {
        return BOTTOM_LINE_NOTICE_ZH;
    }
    return text;
}
