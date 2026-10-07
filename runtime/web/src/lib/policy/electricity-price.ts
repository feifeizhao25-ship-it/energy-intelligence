/**
 * 测算用的省级电价配置。数据只来自 lib/pricing/tariffs.ts 这一张表，本文件不再自带数字。
 * 查不到的省份、已取消固定分时的省份都会抛出 TariffUnavailableError（message 为中文，可直接展示），
 * 不再按「通用」0.75 元或北京兜底。
 */
import {
  lookupTariff,
  TariffUnavailableError,
  type TimeWindow,
  type TariffFreshness,
  NEW_ENERGY_FEED_IN_BASIS,
} from '@/lib/pricing/tariffs';

export interface ElectricityPriceConfig {
  province: string;
  retailPrice: number; // 工商业平均购电电价 (元/kWh)，见 averageRetailPrice
  feedInTariff: number; // 上网电价参考 (元/kWh)：取燃煤发电基准价（来源待核实），见 feedInBasis
  /** 136 号文后新能源上网电价市场化 / 机制电价说明 */
  feedInBasis: string;
  peakValleySupport: boolean;
  peaks: TimeWindow[];
  valleys: TimeWindow[];
  peakPrice?: number;
  valleyPrice?: number;
  /** 依据文件；未核实的写「来源待核实」 */
  source: string;
  /** 数据截至（原样） */
  asOf: string | null;
  freshness: TariffFreshness;
}

export function getPriceConfig(province: string, now: Date = new Date()): ElectricityPriceConfig {
  const found = lookupTariff(province, now);
  if (found.status !== 'ok') throw new TariffUnavailableError(found);
  const t = found.tariff;
  if (typeof t.coalBenchmarkPrice !== 'number') {
    throw new TariffUnavailableError({ status: 'missing', province: found.province, message: '暂无该省燃煤发电基准价数据，请填写上网电价' });
  }
  return {
    province: found.province,
    retailPrice: found.retailPrice,
    feedInTariff: t.coalBenchmarkPrice,
    feedInBasis: NEW_ENERGY_FEED_IN_BASIS,
    peakValleySupport: (t.peaks?.length ?? 0) > 0,
    peaks: t.peaks ?? [],
    valleys: t.valleys ?? [],
    peakPrice: t.peak,
    valleyPrice: t.valley,
    source: t.source,
    asOf: t.asOf,
    freshness: found.freshness,
  };
}
