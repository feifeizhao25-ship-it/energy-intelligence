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

/** 免责声明按最长跨度抹掉，短句不能先吃掉长句前缀。源码扫描不走这里。 */
const NEGATION_SOURCES: Array<[string, string]> = [
    ['不提供投资建议、收益承诺或价格预测', ''],
    ['不构成投资建议、收益承诺或价格预测', ''],
    ['不提供投资建议或价格预测', ''],
    ['不构成投资建议或价格预测', ''],
    ['不是投资建议或价格预测', ''],
    ['(?:不构成|不提供|不做|不是|并非|不会|不进行)(?:任何)?价格预测', ''],
    ['属于[^。\\n]{0,24}价格预测[^。\\n]{0,8}范畴', ''],
    ['属于[^。\\n]{0,24}投资建议[^。\\n]{0,8}范畴', ''],
    ['(?:无法|不能|不会|不可以|不便)(?:提供|给出|做|进行|回答)[^。\\n]{0,12}(?:价格预测|投资建议|收益承诺)', ''],
    ['涉及[^。\\n]{0,16}(?:价格预测|投资建议)', ''],
    ['(?:不构成|不提供|不做|不是|并非|不给|不作为)投资建议', ''],
    // 用户要求「不要给投资建议」是在禁止建议，不是在索取建议。2026-11-25 实测误拦容量电价/测算方法问法。
    ['(?:请)?不要(?:给(?:出)?|提供|做)[^。\\n]{0,30}(?:投资建议|值得投资|投资的建议)', ''],
    // 「不构成对具体项目的投资建议」「不提供具体的投资建议」中间有修饰，仍是免责声明。
    ['(?:不构成|不提供|不做|不是|并非|不给|不作为|不能视为|不应视为|不应当成|不算)(?:任何|具体的|特定的|对[^。\\n]{0,12}的)?(?:投资建议|收益承诺|价格预测|投资结论)', ''],
    ['(?:避免|不会|不能|不要|请勿)给出(?:任何|具体的|对[^。\\n]{0,12}的)?(?:投资建议|值得投资|价格预测|投资的建议)', ''],
    // 「不能用来判断该不该投」是在拒绝建议，不是在问该不该投。
    ['(?:不能|不要|不会|并非|不是|无法|不可|不必)(?:用来|用以|用于|去)?(?:判断|回答|说明|给出)?[^。\\n]{0,8}(?:该不该投|值不值得投|能不能投|要不要投)', ''],
    // 「不用预测明年电价会上涨」是否定预测，不是在报涨跌。
    ['(?:不用|不要|不能|不会|并非|不是|不做)预测(?:明年|未来|后市|后续)?(?:的)?(?:电价|价格)(?:会|将)?(?:上涨|下跌|涨|跌)', ''],
    ['(?:理解成|说成|当成|视为)[^。\\n]{0,4}保本(?:承诺|收益)', ''],
    ['(?:是否|能否|值不值得)\\s*(?:值得\\s*)?(?:投资|配置|布局)', ''],
    ['保本(?:电价|点|价格|价|线)', ''],
    ['(?:用来|用于|可以|能够|能)(?:比较|衡量|评估|判断|反映)[^。\\n]{0,14}?投资价值', ''],
    ['(?:不构成|不提供|不做|不是|并非)收益承诺', ''],
    ['并非投资建议', ''],
    ['不得用于投资决策', ''],
    ['不用于投资决策', ''],
    ['不是投资结论', ''],
    ['不(?:提供|承诺|给)碳收益', ''],
    ['does not give investment advice', 'i'],
    ['not investment advice', 'i'],
    ['do not give investment advice', 'i'],
    ['not a price forecast', 'i'],
    ['will not rise', 'i'],
    ['will not fall', 'i'],
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
    // 词表不再单列「价格预测」。运行时仍拦住没被免责声明抹掉的这个说法。
    [/价格预测/, '价格预测'],
    [/(电价|价格|硅料).{0,8}(将|会)(上涨|下跌|涨|跌)/, '价格涨跌'],
    [/会涨|会跌/, '涨跌判断'],
    [/(承诺|保证).{0,8}(收益|回报|年化)/, '收益承诺'],
    [/稳赚|保本|必赚|无风险收益|年化保底/, '收益承诺'],
    [/闭眼冲|躺赚|回本神器/, '收益黑话'],
    [/目标价|这只股票|买入评级|个股代码|证券投资咨询/, '证券咨询'],
    [/碳收益/, '收益承诺'],
    [/该不该投|能不能投|要不要投|值不值得投|可以投吗|值得\s*投(?!资|入|放|标)|该不该上(?!报|网|课|班|学)/, '投资询问'],
    // 「官方发布」只在把结论说成官方背书时命中。引用「官方发布的文件/通知」不算。
    [/(?:这是|属于|视为).{0,8}官方发布的(?!文件|通知|原文|政策|办法|公告|网页|链接|文本)|官方发布的(?:结论|认证|推荐|保证|承诺|背书)|官方发布(?:并|且)(?:保证|承诺|推荐)|经官方发布|国家认证|政府推荐|官方认证/, '冒充官方'],
    [/以.{0,8}(?:能源局|发改委|国务院|政府)名义/, '冒充官方'],
    [/recommend(?:ed)?\s+invest/i, 'recommend investing'],
    [/price\s+will\s+(?:rise|fall)/i, 'price forecast'],
    [/guaranteed\s+returns?/i, 'guaranteed return'],
];

// 政策电价机制的事实说明不是价格预测（与后端 bottom_line._POLICY_CONTEXT 等同一口径，2026-11-23 真模型复测发现误拦）。
// 同一句有文件/机制依据、又没有个人判断、未来时点、点位或涨跌幅时，只抹「预计……电价」「电价……会/将涨跌」两小段。
const POLICY_CONTEXT = /〔\d{4}〕\d+号|\d+号文|通知|文件|规定|明确|要求|按照|根据|依据|政策|办法|方案|核定|定价法|原文|条款|纳入|分摊|回收|执行后|实施后|机制/;
const PRICE_OPINION = /我|建议|推荐|锁定|抓紧|尽快|明年|后年|未来|下半年|年底|下个?月|下周|市场情况|走势|行情|判断|看好|看涨|看跌|大幅|暴涨|暴跌|飙升|腰斩|翻倍|预测|预判|必将|必然|肯定|一定会|注定|涨到|跌到|突破|跌破|(?:上涨|下跌|涨|跌|上升|下降|上调|下调)(?:幅度)?\s*(?:约|超过|近|了|为)?\s*\d/;
const POLICY_PRICE_SPANS = [/预计.{0,16}?(?:电价|价格)/g, /(?:电价|价格).{0,8}?(?:将|会)(?:上涨|下跌|涨|跌)/g];
const NOT_NECESSARILY = /(?:不一定|未必|不必然|并不一定)(?:会)?(?:上涨|下跌|涨|跌)/g;
const SENTENCE = /[^。！？!?\n；;]+/g;
const METHOD_PRICE_CONTEXT = /情景|敏感性|输入|口径|边界|来源|测算|作为|注明|变量|假设/;
const METHOD_PRICE_DIRECTION = /上涨|下跌|涨到|跌到|会涨|会跌|将涨|将跌|看涨|看跌|突破|跌破|腰斩|翻倍|必将|必然/;
const METHOD_PRICE_NOUN = /预测电价|电价预测/g;
const OUTPUT_SENTENCE = /[^。！？!?\n；;]+[。！？!?\n；;]*|\n+/g;

function policyPriceSpans(raw: string): Array<[number, number]> {
    const spans: Array<[number, number]> = [];
    SENTENCE.lastIndex = 0;
    for (const sentence of raw.matchAll(SENTENCE)) {
        const body = sentence[0];
        const base = sentence.index ?? 0;
        const patterns = [NOT_NECESSARILY];
        if (POLICY_CONTEXT.test(body) && !PRICE_OPINION.test(body)) patterns.push(...POLICY_PRICE_SPANS);
        if (METHOD_PRICE_CONTEXT.test(body) && !METHOD_PRICE_DIRECTION.test(body)) patterns.push(METHOD_PRICE_NOUN);
        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            for (const match of body.matchAll(pattern)) {
                const start = base + (match.index ?? 0);
                spans.push([start, start + match[0].length]);
            }
        }
    }
    return spans;
}

function maskNegations(text: string): string {
    const raw = text || '';
    const spans: Array<[number, number]> = [];
    for (const [source, flags] of NEGATION_SOURCES) {
        const pattern = new RegExp(source, flags.includes('g') ? flags : `${flags}g`);
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(raw)) !== null) {
            if (match[0].length === 0) {
                pattern.lastIndex += 1;
                continue;
            }
            spans.push([match.index, match.index + match[0].length]);
        }
    }
    spans.push(...policyPriceSpans(raw));
    for (const phrase of [BOTTOM_LINE_NOTICE_ZH, BOTTOM_LINE_NOTICE_EN]) {
        let start = 0;
        while (start <= raw.length) {
            const idx = raw.indexOf(phrase, start);
            if (idx < 0) break;
            spans.push([idx, idx + phrase.length]);
            start = idx + phrase.length;
        }
    }
    if (!spans.length) return raw;
    spans.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]) || a[0] - b[0]);
    const chosen: Array<[number, number]> = [];
    for (const [start, end] of spans) {
        if (chosen.some(([keptStart, keptEnd]) => !(end <= keptStart || start >= keptEnd))) continue;
        chosen.push([start, end]);
    }
    const chars = Array.from(raw);
    for (const [start, end] of chosen) {
        for (let index = start; index < end; index += 1) chars[index] = ' ';
    }
    return chars.join('');
}

function findRuntimeExact(text: string): string[] {
    const lower = maskNegations(text).toLowerCase();
    return bottomLineTerms().filter(term => lower.includes(term.toLowerCase()));
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

function sliceViolates(masked: string): boolean {
    return findRuntimeExact(masked).length > 0 || findParaphraseViolations(masked).length > 0;
}

/** 国内文本：在整段上识别否定，只删仍违规的句子。分片要先拼好再调用。删完没有剩余或剩余仍违规时，整段换成标准说明。 */
export function neutralizeCnText(text: string): string {
    const raw = text || '';
    if (!raw) return raw;
    const masked = maskNegations(raw);
    if (!sliceViolates(masked)) return raw;
    const kept: string[] = [];
    OUTPUT_SENTENCE.lastIndex = 0;
    for (const match of raw.matchAll(OUTPUT_SENTENCE)) {
        const start = match.index ?? 0;
        if (sliceViolates(masked.slice(start, start + match[0].length))) continue;
        kept.push(match[0]);
    }
    const body = kept.join('').trim();
    if (!body || sliceViolates(maskNegations(body))) return BOTTOM_LINE_NOTICE_ZH;
    return body;
}
