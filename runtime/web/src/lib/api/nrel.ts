import { loadSolarResource } from '@/lib/calculator/solar-resource';
import { simulateSolar } from '@/lib/calculator/solar';

type PvWattsResult = {
  annualEnergyKwh: number;
  monthlyEnergyKwh: number[];
  capacityFactorPercent: number;
  stationDistanceKm?: number;
  source: string;
};

export async function getPVWattsData(
  lat: number,
  lng: number,
  capacityKw: number,
  tilt = 30,
  azimuth = 180,
): Promise<PvWattsResult> {
  void lat;
  void lng;
  void capacityKw;
  void tilt;
  void azimuth;
  throw new Error('OVERSEAS_SOURCE_DISABLED');
}

/**
 * 未配置 NREL 或调用失败时的估算兜底。原来是「1350 小时 × 纬度系数」的第三套粗估，
 * 现在改为调用统一光伏模型（lib/calculator/solar.ts simulateSolar），与快速测算同一资源数据、同一口径：
 * 地面电站、标准组件、最佳倾角、正南，全部电量按 electricityPrice 计价。
 */
export async function calculateSolarOutput(
  lat: number,
  lng: number,
  capacityKw: number,
  electricityPrice = 0.5,
  investment?: number,
) {
  const resource = await loadSolarResource(lat, lng);
  const model = simulateSolar(resource, {
    lat,
    capacity: capacityKw,
    installationType: 'ground',
    moduleType: 'standard',
    selfUsePrice: electricityPrice,
    feedInPrice: electricityPrice,
    selfUseRatio: 1,
    // 投资只用于静态回收期；未提供时按组件档位缺省，不进入返回值
    unitCost: investment && investment > 0 ? investment / capacityKw : undefined,
  });
  const annualEnergyKwh = Math.round(model.energy.year1);
  const annualRevenue = annualEnergyKwh * electricityPrice;
  return {
    annualEnergyKwh,
    monthlyEnergyKwh: model.energy.monthly,
    annualRevenue: Math.round(annualRevenue),
    simplePaybackYears: investment && annualRevenue > 0
      ? Number((investment / annualRevenue).toFixed(1))
      : null,
    capacityFactorPercent: Number(((annualEnergyKwh / (capacityKw * 8760)) * 100).toFixed(2)),
    performanceRatio: Number(model.energy.pr.toFixed(4)),
    coordinates: { lat, lng },
    source: '统一光伏模型（NASA POWER 上一完整年辐照与气温）',
    warning: '估算结果仅供初筛，正式核算前应使用现场或已授权的长期数据复核。',
  };
}
