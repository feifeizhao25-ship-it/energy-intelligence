/**
 * 风电、储能测算取电价：默认读省级电价表（lib/pricing/tariffs.ts），用户填写的值优先。
 *
 * 原来 /api/calculate/storage 写死「峰 1.0 / 谷 0.3 / 平 0.6」，/api/calculate/wind 与风电引擎写死上网电价 0.4、
 * 自用电价 0.6，储能页面还写死江苏和「峰 1.1 / 谷 0.3」，用户既看不到来源也改不了。
 *
 * 规则：
 * - 用户填了就用用户的（记在 pricing.userProvided 里），没填的才查表；
 * - 表里条目「来源待核实」的，原样带出这个状态，页面照样显示；
 * - 已取消固定分时的省份（1656 号文）和表里没有的省份：查不到就让用户填，不按其他省份兜底、不编数字；
 * - 「上网电价」默认取燃煤发电基准价作参考，并附 136 号文后新能源上网电价市场化 / 机制电价的说明。
 */
import {
    lookupTariff,
    sourceStatusLabel,
    NEW_ENERGY_FEED_IN_BASIS,
    NO_PROVINCE_DATA,
    MARKET_TOU_NOTICE,
    COAL_BENCHMARK_NOTE,
    type ProvinceTariff,
} from './tariffs';

export type PricingInfo = {
    province: string;
    /** 依据文件；用户全部自填时为「用户输入」 */
    source: string;
    /** 「来源待核实」「来源已核实」「用户输入」 */
    sourceStatus: string;
    asOfLabel: string | null;
    stale: boolean;
    staleNote: string | null;
    /** 哪些价格是用户填写的 */
    userProvided: string[];
    /** 上网电价说明（136 号文后市场化 / 机制电价）；只在涉及上网电价时有 */
    feedInBasis?: string;
    /** 本次测算实际用的电价（元/度），键为中文名称，例如 { 上网电价: 0.391 } */
    values: Record<string, number>;
};

export interface TariffDefaults {
    province: string;
    status: 'ok' | 'market' | 'missing';
    /** status 不是 ok 时给用户看的中文说明 */
    message: string | null;
    peak: number | null;
    flat: number | null;
    valley: number | null;
    sharp: number | null;
    /** 工商业平均电价（峰 4 : 平 8 : 谷 12 小时加权，或原表直接给出） */
    averageRetail: number | null;
    /** 燃煤发电基准价（原表数值，来源待核实），作新能源上网电价参考 */
    coalBenchmarkPrice: number | null;
    feedInBasis: string;
    /** 燃煤发电基准价的来源说明；表里没有该价时为 null */
    coalBenchmarkNote: string | null;
    /** 没有可用的上网电价参考时给用户看的说明（与分时电价无关） */
    feedInMessage: string | null;
    source: string | null;
    sourceStatus: string | null;
    asOfLabel: string | null;
    stale: boolean;
    staleNote: string | null;
    note: string | null;
}

export class PriceInputError extends Error {
    constructor(message: string, public readonly code: 'PRICE_REQUIRED' | 'INVALID_PRICE') {
        super(message);
        this.name = 'PriceInputError';
    }
}

const num = (v: number | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** 给页面预填用：某省的分时电价、平均电价、燃煤发电基准价及来源状态。 */
export function tariffDefaults(provinceName: string | null | undefined, now: Date = new Date()): TariffDefaults {
    const found = lookupTariff(provinceName, now);
    const base = {
        province: found.province, peak: null, flat: null, valley: null, sharp: null, averageRetail: null,
        coalBenchmarkPrice: null, feedInBasis: NEW_ENERGY_FEED_IN_BASIS, coalBenchmarkNote: null,
        feedInMessage: noFeedInMessage(found.province),
        source: null, sourceStatus: null, asOfLabel: null, stale: false, staleNote: null, note: null,
    };
    if (found.status === 'missing') {
        return { ...base, status: 'missing', message: found.province ? `${found.province}${NO_PROVINCE_DATA}，请按你的电费单或合同填写电价` : '请选择省份，或直接填写电价' };
    }
    const t: ProvinceTariff = found.tariff;
    // 上网电价参考（燃煤发电基准价）与分时电价是两回事：已取消固定分时的省份只要表里有基准价也照样给出
    const coal = num(t.coalBenchmarkPrice);
    const meta = {
        source: t.source, sourceStatus: sourceStatusLabel(t), note: t.note ?? null,
        coalBenchmarkPrice: coal, coalBenchmarkNote: coal === null ? null : COAL_BENCHMARK_NOTE,
        feedInMessage: coal === null ? noFeedInMessage(found.province) : null,
    };
    if (found.status === 'market') {
        return { ...base, ...meta, status: 'market', message: `${found.message}。储能请填写你的充电、放电电价（合同价或市场价）` };
    }
    return {
        ...base, ...meta, status: 'ok', message: null,
        peak: num(t.peak), flat: num(t.flat), valley: num(t.valley), sharp: num(t.sharp),
        averageRetail: found.retailPrice,
        asOfLabel: found.freshness.label, stale: found.freshness.stale, staleNote: found.freshness.staleNote,
    };
}

/** 没有可用上网电价参考时的提示：讲上网电价本身的原因（136 号文），不扯分时电价 */
function noFeedInMessage(province: string): string {
    const who = province ? `电价表里没有${province}可用的上网电价参考` : '请选择省份';
    return `${who}。新能源上网电价按发改价格〔2025〕136 号执行机制电价与市场化交易，请填写你的机制电价或合同价`;
}

/** 用户输入：空、null 视为没填；填了但不是 ≥0 的数字则报错（不静默改成默认值）。 */
function readOverride(raw: unknown, label: string): number | undefined {
    if (raw === undefined || raw === null || raw === '') return undefined;
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 10) throw new PriceInputError(`${label}须为 0–10 元/度之间的数字`, 'INVALID_PRICE');
    return value;
}

function pricingInfo(defaults: TariffDefaults, userProvided: string[], allUser: boolean, withFeedIn: boolean, values: Record<string, number>): PricingInfo {
    const fromTable = !allUser;
    return {
        province: defaults.province,
        source: fromTable ? (defaults.source ?? '用户输入') : '用户输入',
        sourceStatus: fromTable ? (defaults.sourceStatus ?? '用户输入') : '用户输入',
        asOfLabel: fromTable ? defaults.asOfLabel : null,
        stale: fromTable ? defaults.stale : false,
        staleNote: fromTable ? defaults.staleNote : null,
        userProvided,
        values,
        ...(withFeedIn ? { feedInBasis: NEW_ENERGY_FEED_IN_BASIS } : {}),
    };
}

function requireTable(defaults: TariffDefaults, what: string): void {
    if (defaults.status === 'ok') return;
    const reason = defaults.status === 'market' ? `${defaults.province}${MARKET_TOU_NOTICE}` : (defaults.message ?? NO_PROVINCE_DATA);
    throw new PriceInputError(`${reason}。请填写${what}后再测算`, 'PRICE_REQUIRED');
}

/**
 * 储能套利电价：峰（放电）、谷（充电）；平段价只在「两充两放」（第二次在平段充电）时需要。
 */
export function resolveStoragePrices(
    province: string | null | undefined,
    overrides: { peakPrice?: unknown; valleyPrice?: unknown; flatPrice?: unknown },
    options: { needsFlat?: boolean; now?: Date } = {},
): { peakPrice: number; valleyPrice: number; flatPrice: number | undefined; pricing: PricingInfo } {
    const now = options.now ?? new Date();
    const user = {
        peakPrice: readOverride(overrides.peakPrice, '峰时电价'),
        valleyPrice: readOverride(overrides.valleyPrice, '谷时电价'),
        flatPrice: readOverride(overrides.flatPrice, '平时电价'),
    };
    const userProvided = Object.entries(user).filter(([, v]) => v !== undefined).map(([k]) => k);
    const defaults = tariffDefaults(province, now);
    const needed = options.needsFlat ? ['peakPrice', 'valleyPrice', 'flatPrice'] : ['peakPrice', 'valleyPrice'];
    const allUser = needed.every(k => userProvided.includes(k));
    if (!allUser) requireTable(defaults, options.needsFlat ? '峰、平、谷电价' : '峰、谷电价');
    const pick = (value: number | undefined, fallback: number | null, label: string) => {
        if (value !== undefined) return value;
        if (fallback === null) throw new PriceInputError(`电价表里没有${defaults.province}的${label}，请填写`, 'PRICE_REQUIRED');
        return fallback;
    };
    const peakPrice = pick(user.peakPrice, defaults.peak, '峰时电价');
    const valleyPrice = pick(user.valleyPrice, defaults.valley, '谷时电价');
    // 山东等原表没有平段价的省份：需要平段价时必须由用户填写，不按峰谷均值编造
    const flatPrice = options.needsFlat
        ? pick(user.flatPrice, defaults.flat, '平时电价')
        : user.flatPrice ?? (allUser ? undefined : defaults.flat ?? undefined);
    const values: Record<string, number> = { 峰时电价: peakPrice, 谷时电价: valleyPrice };
    if (flatPrice !== undefined) values['平时电价'] = flatPrice;
    return { peakPrice, valleyPrice, flatPrice, pricing: pricingInfo(defaults, userProvided, allUser, false, values) };
}

/** 风电电价：上网电价（全额上网/余电上网部分），自用电价（自发自用部分）。 */
export function resolveWindPrices(
    province: string | null | undefined,
    overrides: { feedInTariff?: unknown; electricityPrice?: unknown },
    mode: 'full_export' | 'self_use_export',
    now: Date = new Date(),
): { feedInTariff: number; electricityPrice: number | undefined; pricing: PricingInfo } {
    const user = {
        feedInTariff: readOverride(overrides.feedInTariff, '上网电价'),
        electricityPrice: mode === 'self_use_export' ? readOverride(overrides.electricityPrice, '自用电价') : undefined,
    };
    const needed = mode === 'self_use_export' ? 2 : 1;
    const userProvided = Object.entries(user).filter(([, v]) => v !== undefined).map(([k]) => k);
    const defaults = tariffDefaults(province, now);
    const allUser = userProvided.length === needed;
    let feedInTariff = user.feedInTariff;
    if (feedInTariff === undefined) {
        // 上网电价与分时电价脱钩：只看表里有没有燃煤发电基准价参考
        if (defaults.coalBenchmarkPrice === null) {
            throw new PriceInputError(defaults.feedInMessage ?? '请填写上网电价（机制电价或合同价）', 'PRICE_REQUIRED');
        }
        feedInTariff = defaults.coalBenchmarkPrice;
    }
    let electricityPrice: number | undefined;
    if (mode === 'self_use_export') {
        // 自发自用部分抵扣的是用户侧电价，这里才和分时电价表有关
        if (user.electricityPrice === undefined) requireTable(defaults, '自用电价');
        electricityPrice = user.electricityPrice ?? defaults.averageRetail ?? undefined;
        if (electricityPrice === undefined) throw new PriceInputError(`电价表里没有${defaults.province}的工商业电价，请填写自用电价`, 'PRICE_REQUIRED');
    }
    const values: Record<string, number> = { 上网电价: feedInTariff };
    if (electricityPrice !== undefined) values['自用电价'] = electricityPrice;
    return { feedInTariff, electricityPrice, pricing: pricingInfo(defaults, userProvided, allUser, true, values) };
}
