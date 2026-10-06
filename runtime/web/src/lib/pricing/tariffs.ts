/**
 * 全站唯一的省级电价参考表。
 *
 * 以前有三张表：lib/crawler/price-crawler.ts（2025-12 分时价）、lib/policy/electricity-price.ts
 * （注释「2024 年」，含峰谷时段与上网电价）、lib/ai/tools.ts（AI 工具里的「模拟返回」，查不到一律按北京）。
 * 同一次光伏测算会在两张表之间取到不同的江苏谷价（0.31 vs 0.25）。现在合并为这一张，
 * 价格、截至日期以原 price-crawler 表为准；其余字段保留原表数字，并如实标注来源。
 *
 * 规则：
 * - 不编造数字。原表没有附文件的，source 写「来源待核实」，sourceVerified = false。
 * - 已取消固定分时的省份（《电力中长期市场基本规则》发改能源规〔2025〕1656 号，2026-03-01 起）
 *   不输出写死的峰谷时段，测算须由用户输入合同电价。
 * - 查不到的省份返回「暂无该省数据」，绝不按北京或其他省份兜底。
 * - asOf 为「数据截至」日期，可为 YYYY / YYYY-MM / YYYY-MM-DD；超过 90 天提示可能已变化。
 */

export type TouStatus = 'fixed' | 'market';

export interface TimeWindow { start: number; end: number }

export interface ProvinceTariff {
    province: string;
    /** fixed = 仍执行固定峰谷时段；market = 已取消固定分时，按市场化交易价格 */
    touStatus: TouStatus;
    /** 工商业分时电价（元/kWh） */
    peak?: number;
    flat?: number;
    valley?: number;
    sharp?: number;
    /** 工商业平均购电电价（元/kWh）。仅当原表直接给出时才有；否则由分时价按 峰4:平8:谷12 小时加权得出 */
    retailPrice?: number;
    /** 上网电价参考（元/kWh），原表标注为「脱硫煤标杆上网电价」 */
    feedInTariff?: number;
    /** 固定分时时段（小时），仅 touStatus = fixed 时有 */
    peaks?: TimeWindow[];
    valleys?: TimeWindow[];
    /** 居民电价（元/kWh），仅部分省份有 */
    residential?: { peak: number; flat: number; valley: number };
    /** 依据文件名/文号；没有的写「来源待核实（…）」 */
    source: string;
    sourceVerified: boolean;
    /** 文件生效日期，未知为 null */
    effectiveDate: string | null;
    /** 数据截至（YYYY / YYYY-MM / YYYY-MM-DD），未标注为 null */
    asOf: string | null;
    note?: string;
}

export const TOU_REFORM_BASIS = '《电力中长期市场基本规则》（发改能源规〔2025〕1656 号），2026-03-01 起';
export const MARKET_TOU_NOTICE = '已取消固定分时，按市场化交易价格测算，请输入合同电价';
export const NO_PROVINCE_DATA = '暂无该省数据';
export const PRICE_STALE_DAYS = 90;
export const PRICE_STALE_NOTE = '可能已变化，请以最新文件为准';

const UNVERIFIED_Q4_2025 = '来源待核实（原 price-crawler 静态表，注明「2025 年 Q4 参考值」，未附文件）';
const UNVERIFIED_2024 = '来源待核实（原 electricity-price 表，注明「2024 年」参考电价，未附文件）';
const FEED_IN_NOTE = '上网电价取原表「脱硫煤标杆上网电价」，来源待核实；发改价格〔2025〕136 号后新能源上网电价已市场化，需按机制电价/市场电价复核';

function marketProvince(province: string, note?: string): ProvinceTariff {
    return {
        province,
        touStatus: 'market',
        source: TOU_REFORM_BASIS,
        sourceVerified: true,
        effectiveDate: '2026-03-01',
        asOf: null,
        note,
    };
}

export const TARIFFS: Record<string, ProvinceTariff> = {
    '江苏': {
        province: '江苏', touStatus: 'fixed',
        valley: 0.31, flat: 0.64, peak: 1.08, sharp: 1.25, feedInTariff: 0.391,
        peaks: [{ start: 8, end: 11 }, { start: 17, end: 22 }], valleys: [{ start: 0, end: 8 }],
        source: UNVERIFIED_Q4_2025, sourceVerified: false, effectiveDate: null, asOf: '2025-12-01',
        note: `峰谷时段沿用原 2024 年表，来源待核实。${FEED_IN_NOTE}`,
    },
    '浙江': {
        province: '浙江', touStatus: 'fixed',
        valley: 0.28, flat: 0.62, peak: 1.12, sharp: 1.35, feedInTariff: 0.4153,
        peaks: [{ start: 9, end: 11 }, { start: 15, end: 17 }, { start: 19, end: 21 }], valleys: [{ start: 0, end: 8 }],
        source: UNVERIFIED_Q4_2025, sourceVerified: false, effectiveDate: null, asOf: '2025-12-05',
        note: `峰谷时段沿用原 2024 年表，来源待核实。${FEED_IN_NOTE}`,
    },
    '广东': {
        province: '广东', touStatus: 'fixed',
        valley: 0.25, flat: 0.68, peak: 1.20, sharp: 1.45, feedInTariff: 0.453,
        peaks: [{ start: 10, end: 12 }, { start: 14, end: 19 }], valleys: [{ start: 0, end: 8 }],
        source: UNVERIFIED_Q4_2025, sourceVerified: false, effectiveDate: null, asOf: '2025-12-10',
        note: `峰谷时段沿用原 2024 年表，来源待核实。${FEED_IN_NOTE}`,
    },
    '北京': {
        province: '北京', touStatus: 'fixed',
        valley: 0.35, flat: 0.72, peak: 1.15, feedInTariff: 0.3533,
        peaks: [{ start: 10, end: 15 }, { start: 18, end: 21 }], valleys: [{ start: 23, end: 7 }],
        residential: { peak: 0.4883, flat: 0.3883, valley: 0.2883 },
        source: UNVERIFIED_Q4_2025, sourceVerified: false, effectiveDate: null, asOf: '2025-11-20',
        note: `峰谷时段沿用原 2024 年表；居民电价为原 AI 工具里的示例值，均来源待核实。${FEED_IN_NOTE}`,
    },
    '上海': {
        province: '上海', touStatus: 'fixed',
        valley: 0.32, flat: 0.70, peak: 1.18, sharp: 1.30, feedInTariff: 0.4155,
        peaks: [{ start: 8, end: 11 }, { start: 18, end: 21 }], valleys: [{ start: 22, end: 6 }],
        residential: { peak: 0.617, flat: 0.462, valley: 0.307 },
        source: UNVERIFIED_Q4_2025, sourceVerified: false, effectiveDate: null, asOf: '2025-12-08',
        note: `峰谷时段沿用原 2024 年表；居民电价为原 AI 工具里的示例值，均来源待核实。${FEED_IN_NOTE}`,
    },
    '山东': {
        province: '山东', touStatus: 'fixed',
        retailPrice: 0.72, peak: 1.05, valley: 0.15, feedInTariff: 0.3949,
        peaks: [{ start: 18, end: 22 }], valleys: [{ start: 11, end: 14 }], // 午间深谷
        source: UNVERIFIED_2024, sourceVerified: false, effectiveDate: null, asOf: '2024',
        note: FEED_IN_NOTE,
    },
    // 河北：河北南网已取消固定分时；原表的峰谷时段（谷段 11–16 点）与政策冲突，已删除。
    // 冀北电网是否同样取消未核实，表里只有一个「河北」条目，统一按市场化处理。
    '河北': {
        ...marketProvince('河北', '河北南网已取消固定分时；冀北电网未核实。原表工商业平均电价 0.68、上网电价 0.3644 元/kWh（2024 年，来源待核实）仅供参考，不参与测算'),
    },
    '贵州': marketProvince('贵州'),
    '湖北': marketProvince('湖北'),
    '陕西': marketProvince('陕西'),
    '吉林': marketProvince('吉林'),
    '云南': marketProvince('云南'),
    '重庆': marketProvince('重庆'),
    '辽宁': marketProvince('辽宁'),
    '河南': marketProvince('河南'),
};

/** 「江苏省」「北京市」「河北南网」「广西壮族自治区」→ 表里的键 */
export function normalizeProvince(name: string | null | undefined): string {
    const raw = String(name ?? '').trim();
    if (!raw) return '';
    if (raw.startsWith('河北')) return '河北';
    return raw.replace(/(壮族|回族|维吾尔)?自治区$|特别行政区$|省$|市$/, '');
}

/** 由分时价按 峰4:平8:谷12 小时加权得到工商业平均电价（与 calculateAveragePrice 口径一致）。缺分项时返回 undefined。 */
export function averageRetailPrice(t: ProvinceTariff): number | undefined {
    if (typeof t.retailPrice === 'number') return t.retailPrice;
    if (typeof t.peak === 'number' && typeof t.flat === 'number' && typeof t.valley === 'number') {
        return Number(((t.peak * 4 + t.flat * 8 + t.valley * 12) / 24).toFixed(4));
    }
    return undefined;
}

/** 把 asOf 的结束时刻作为「截至」时刻（只写年份的按年末算，只写月份的按月末算）。 */
function asOfEnd(asOf: string): Date | null {
    const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(asOf);
    if (!m) return null;
    const y = Number(m[1]);
    if (m[3]) return new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3])));
    if (m[2]) return new Date(Date.UTC(y, Number(m[2]), 0));
    return new Date(Date.UTC(y, 11, 31));
}

export interface TariffFreshness {
    /** 例：「电价数据截至 2025-12」 */
    label: string;
    stale: boolean;
    /** stale 时为「可能已变化，请以最新文件为准」 */
    staleNote: string | null;
}

export function tariffFreshness(asOf: string | null | undefined, now: Date = new Date()): TariffFreshness {
    if (!asOf) return { label: '电价数据截至：未标注', stale: true, staleNote: PRICE_STALE_NOTE };
    const end = asOfEnd(asOf);
    const shown = asOf.length >= 7 ? asOf.slice(0, 7) : `${asOf} 年`;
    if (!end) return { label: `电价数据截至 ${asOf}`, stale: true, staleNote: PRICE_STALE_NOTE };
    const stale = (now.getTime() - end.getTime()) / 86_400_000 > PRICE_STALE_DAYS;
    return { label: `电价数据截至 ${shown}`, stale, staleNote: stale ? PRICE_STALE_NOTE : null };
}

export type TariffLookup =
    | { status: 'ok'; province: string; tariff: ProvinceTariff; retailPrice: number; freshness: TariffFreshness }
    | { status: 'market'; province: string; tariff: ProvinceTariff; message: string }
    | { status: 'missing'; province: string; message: string };

export function lookupTariff(provinceName: string | null | undefined, now: Date = new Date()): TariffLookup {
    const province = normalizeProvince(provinceName);
    const tariff = TARIFFS[province];
    if (!tariff) return { status: 'missing', province: province || String(provinceName ?? ''), message: NO_PROVINCE_DATA };
    if (tariff.touStatus === 'market') {
        return { status: 'market', province, tariff, message: `${province}${MARKET_TOU_NOTICE}（依据${TOU_REFORM_BASIS}）` };
    }
    const retailPrice = averageRetailPrice(tariff);
    if (retailPrice === undefined) return { status: 'missing', province, message: NO_PROVINCE_DATA };
    return { status: 'ok', province, tariff, retailPrice, freshness: tariffFreshness(tariff.asOf, now) };
}

/** 收录了价格（可用于测算）的省份 */
export function provincesWithPrices(): string[] {
    return Object.values(TARIFFS).filter(t => t.touStatus === 'fixed' && averageRetailPrice(t) !== undefined).map(t => t.province);
}

/** 测算无法取到电价时抛出，message 是可直接给用户看的中文 */
export class TariffUnavailableError extends Error {
    constructor(public readonly lookup: Exclude<TariffLookup, { status: 'ok' }>) {
        super(lookup.message);
        this.name = 'TariffUnavailableError';
    }
}

/** 结果页、报告统一的电价时效说明 */
export function priceAsOfText(pricing?: { asOfLabel?: string | null; staleNote?: string | null; source?: string | null } | null): string {
    if (!pricing || !pricing.asOfLabel) return '电价：用户输入或测算默认值，未使用省级电价表';
    const stale = pricing.staleNote ? `，${pricing.staleNote}` : '';
    const source = pricing.source ? `（来源：${pricing.source}）` : '';
    return `${pricing.asOfLabel}${stale}${source}`;
}
