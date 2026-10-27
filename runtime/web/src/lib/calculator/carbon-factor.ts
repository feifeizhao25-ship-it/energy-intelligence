/** 排放测算只引用全站唯一因子，不另写数值，也不计算额外收益。 */

import { EMISSION_FACTOR_NOTE, GRID_EMISSION_FACTOR } from '@/lib/standards/emission-factor';

export const GRID_FACTOR_TCO2_PER_MWH = GRID_EMISSION_FACTOR.value;
export const GRID_FACTOR_SOURCE = GRID_EMISSION_FACTOR.source;
export const GRID_FACTOR_URL = 'https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html';

export function estimateGridEmission(annualGenerationMwh: number) {
  if (!Number.isFinite(annualGenerationMwh) || annualGenerationMwh < 0) {
    throw new Error('年发电量必须是非负数字');
  }
  const tonnes = annualGenerationMwh * GRID_EMISSION_FACTOR.value;
  return {
    annualGenerationMwh,
    tonnesCo2: Math.round(tonnes * 1e6) / 1e6,
    factor: GRID_EMISSION_FACTOR.value,
    unit: GRID_EMISSION_FACTOR.unit,
    source: GRID_FACTOR_SOURCE,
    sourceUrl: GRID_FACTOR_URL,
    ccerRevenueCny: null,
    ccerNote: '陆上风电和光伏目前不按此页计算额外收益。没有适用方法学时不填写金额。',
    assumptions: [
      EMISSION_FACTOR_NOTE,
      '年上网电量按兆瓦时填写时，与因子相乘得到的是同一口径下的吨数。',
      '这不是碳资产售价，也不是投资结论。',
    ],
  };
}
