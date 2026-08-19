/**
 * 电价数据抓取与同步服务
 */
import axios from 'axios';

export interface ElectricityPrice {
    province: string;
    valley: number; // 谷期电价
    flat: number;   // 平期电价
    peak: number;   // 峰期电价
    sharp?: number; // 尖峰电价
    updatedAt: string;
}

// 静态备份数据 (2025年Q4参考值)
const STATIC_PRICES: Record<string, ElectricityPrice> = {
    '江苏': { province: '江苏', valley: 0.31, flat: 0.64, peak: 1.08, sharp: 1.25, updatedAt: '2025-12-01' },
    '浙江': { province: '浙江', valley: 0.28, flat: 0.62, peak: 1.12, sharp: 1.35, updatedAt: '2025-12-05' },
    '广东': { province: '广东', valley: 0.25, flat: 0.68, peak: 1.20, sharp: 1.45, updatedAt: '2025-12-10' },
    '北京': { province: '北京', valley: 0.35, flat: 0.72, peak: 1.15, updatedAt: '2025-11-20' },
    '上海': { province: '上海', valley: 0.32, flat: 0.70, peak: 1.18, sharp: 1.30, updatedAt: '2025-12-08' },
};

/** 静态备份数据的有效期（天）。超期即视为不可信。 */
const STATIC_PRICE_MAX_AGE_DAYS = 90;

export interface PriceResult extends ElectricityPrice {
    /** 数据来源：live=实时抓取，static=静态备份，fallback=跨省兜底 */
    source: 'live' | 'static' | 'fallback';
    /** 数据是否已超出有效期，UI 应据此提示用户 */
    stale: boolean;
}

function _ageInDays(updatedAt: string): number {
    const t = Date.parse(updatedAt);
    if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
    return (Date.now() - t) / 86400000;
}

/**
 * 获取指定省份的最新电价。
 *
 * 修复要点：
 * 1. 原实现的"抓取"是一个直接返回静态常量的 mockCrawl，从未真正联网。
 *    现改为在配置了 ELECTRICITY_PRICE_API_URL 时真实请求；未配置才退到静态表。
 * 2. 原实现对未收录省份静默返回江苏电价，会让其他省份的收益测算全部算错。
 *    现改为抛错，由调用方决定如何提示，绝不静默替换。
 * 3. 返回值带上 source/stale，让上层能把"数据是 8 个月前的备份"这件事告诉用户。
 */
export async function getLatestPrice(province: string): Promise<PriceResult> {
    const apiUrl = process.env.ELECTRICITY_PRICE_API_URL;

    if (apiUrl) {
        try {
            const resp = await axios.get(apiUrl, {
                params: { province },
                timeout: 8000,
            });
            const data = resp.data as ElectricityPrice;
            if (data && typeof data.flat === 'number') {
                return { ...data, source: 'live', stale: false };
            }
            console.warn(`Price API returned unusable payload for ${province}`);
        } catch (error) {
            console.warn(`Price API request failed for ${province}:`, error);
        }
    }

    const price = STATIC_PRICES[province];
    if (price) {
        const stale = _ageInDays(price.updatedAt) > STATIC_PRICE_MAX_AGE_DAYS;
        if (stale) {
            console.warn(
                `Electricity price for ${province} is from ${price.updatedAt} ` +
                `(> ${STATIC_PRICE_MAX_AGE_DAYS} days old) — results should be labelled as estimates.`
            );
        }
        return { ...price, source: 'static', stale };
    }

    // 未收录的省份不再兜底成江苏电价——那会让测算结果错得毫无察觉。
    throw new Error(
        `ELECTRICITY_PRICE_UNAVAILABLE: no price data for province "${province}". ` +
        `Configure ELECTRICITY_PRICE_API_URL or add the province to STATIC_PRICES.`
    );
}

/**
 * 计算加权平均电价 (基于工商业典型负荷曲线)。
 *
 * @param price        分时电价
 * @param selfUseRatio 自发自用比例 0~1。自用部分抵扣的是用电电价（按峰平谷加权），
 *                     余电上网部分按上网电价结算。
 * @param feedInTariff 余电上网电价（元/kWh）。缺省时取谷电价作为保守估计。
 *
 * 修复要点：原实现注释写"峰平谷 4:8:12"，代码却用 0.3/0.4/0.3，两者不一致；
 * 且 selfUseRatio 传入后完全没有参与计算，导致自用比例不影响收益模型。
 */
export function calculateAveragePrice(
    price: ElectricityPrice,
    selfUseRatio: number,
    feedInTariff?: number,
): number {
    // 工商业典型负荷曲线：峰 4h : 平 8h : 谷 12h（与注释一致）
    const PEAK_HOURS = 4;
    const FLAT_HOURS = 8;
    const VALLEY_HOURS = 12;
    const TOTAL_HOURS = PEAK_HOURS + FLAT_HOURS + VALLEY_HOURS;

    const selfUsePrice =
        (price.peak * PEAK_HOURS +
            price.flat * FLAT_HOURS +
            price.valley * VALLEY_HOURS) / TOTAL_HOURS;

    const ratio = Math.min(1, Math.max(0, selfUseRatio));
    const gridPrice = feedInTariff ?? price.valley;

    const weighted = selfUsePrice * ratio + gridPrice * (1 - ratio);
    return Number(weighted.toFixed(4));
}
