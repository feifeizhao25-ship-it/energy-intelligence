/** 排放测算只引用公告 2025 年第 47 号的因子表，不另写数值，也不计算额外收益。 */

import { emissionFactorNoteFor, GRID_EMISSION_FACTOR, resolveEmissionFactor } from '@/lib/standards/emission-factor';

export const GRID_FACTOR_TCO2_PER_MWH = GRID_EMISSION_FACTOR.value;
export const GRID_FACTOR_SOURCE = GRID_EMISSION_FACTOR.source;
export const GRID_FACTOR_URL = 'https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html';

export function estimateGridEmission(annualGenerationMwh: number, province?: string | null) {
  if (!Number.isFinite(annualGenerationMwh) || annualGenerationMwh < 0) {
    throw new Error('年发电量必须是非负数字');
  }
  const factor = resolveEmissionFactor(province);
  const tonnes = annualGenerationMwh * factor.value;
  return {
    annualGenerationMwh,
    tonnesCo2: Math.round(tonnes * 1e6) / 1e6,
    factor: factor.value,
    unit: factor.unit,
    scope: factor.scope,
    province: factor.province,
    source: factor.source,
    sourceUrl: GRID_FACTOR_URL,
    ccerRevenueCny: null,
    ccerNote: '陆上风电和光伏目前不按此页计算额外收益。没有适用方法学时不填写金额。',
    assumptions: [
      emissionFactorNoteFor(province),
      '已知省份用公告附件表 3 的 2023 年省级因子；没有省份，或公告未收录该省时，用表 1 的全国平均。',
      '年上网电量按兆瓦时填写时，与因子相乘得到的是同一口径下的吨数。',
      '这不是碳资产售价，也不是投资结论。',
    ],
  };
}
