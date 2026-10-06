/**
 * 电价数据抓取与同步服务
 */
import axios from 'axios';
import {
    lookupTariff,
    tariffFreshness,
    TariffUnavailableError,
    NO_PROVINCE_DATA,
    PRICE_STALE_DAYS,
} from '@/lib/pricing/tariffs';

export interface ElectricityPrice {
    province: string;
    valley: number; // 谷期电价
    flat: number;   // 平期电价
    peak: number;   // 峰期电价
    sharp?: number; // 尖峰电价
    updatedAt: string;
}

// 静态数据只来自 lib/pricing/tariffs.ts（全站唯一电价表），这里不再自带数字。

export interface PriceResult extends ElectricityPrice {
    /** 数据来源：live=实时接口，static=全站电价表 */
    source: 'live' | 'static';
    /** 数据是否已超出 90 天，UI 应据此提示用户 */
    stale: boolean;
    /** 依据文件；未核实的为「来源待核实（…）」 */
    sourceDoc: string;
    /** 「电价数据截至 2025-12」 */
    asOfLabel: string;
    /** 超期时为「可能已变化，请以最新文件为准」 */
    staleNote: string | null;
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
                const freshness = tariffFreshness(data.updatedAt);
                return {
                    ...data, source: 'live', stale: freshness.stale,
                    sourceDoc: '电价接口（ELECTRICITY_PRICE_API_URL）', asOfLabel: freshness.label, staleNote: freshness.staleNote,
                };
            }
            console.warn(`Price API returned unusable payload for ${province}`);
        } catch (error) {
            console.warn(`Price API request failed for ${province}:`, error);
        }
    }

    // 查表：未收录或已取消固定分时的省份抛出 TariffUnavailableError（中文 message），绝不按其他省份兜底。
    const found = lookupTariff(province);
    if (found.status !== 'ok') throw new TariffUnavailableError(found);
    const t = found.tariff;
    if (typeof t.flat !== 'number' || typeof t.peak !== 'number' || typeof t.valley !== 'number') {
        throw new TariffUnavailableError({ status: 'missing', province: found.province, message: NO_PROVINCE_DATA });
    }
    if (found.freshness.stale) {
        console.warn(`Electricity price for ${found.province} is as of ${t.asOf} (> ${PRICE_STALE_DAYS} days old)`);
    }
    return {
        province: found.province,
        valley: t.valley,
        flat: t.flat,
        peak: t.peak,
        sharp: t.sharp,
        updatedAt: t.asOf ?? '',
        source: 'static',
        stale: found.freshness.stale,
        sourceDoc: t.source,
        asOfLabel: found.freshness.label,
        staleNote: found.freshness.staleNote,
    };
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
