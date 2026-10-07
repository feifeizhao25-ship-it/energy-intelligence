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
  const key = process.env.NREL_API_KEY;
  if (!key) throw new Error('NREL_API_KEY 未配置');

  const query = new URLSearchParams({
    api_key: key,
    lat: String(lat),
    lon: String(lng),
    system_capacity: String(capacityKw),
    azimuth: String(azimuth),
    tilt: String(tilt),
    array_type: '1',
    module_type: '1',
    losses: '14',
  });
  const response = await fetch(`https://developer.nrel.gov/api/pvwatts/v8.json?${query}`, {
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 86400 },
  });
  if (!response.ok) throw new Error(`NREL 请求失败（${response.status}）`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.join('; '));
  const outputs = payload.outputs;
  return {
    annualEnergyKwh: Number(outputs.ac_annual ?? 0),
    monthlyEnergyKwh: (outputs.ac_monthly ?? []).map(Number),
    capacityFactorPercent: Number(outputs.capacity_factor ?? 0),
    stationDistanceKm: payload.station_info?.distance
      ? Number(payload.station_info.distance) / 1000
      : undefined,
    source: 'NREL PVWatts v8',
  };
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
    warning: '估算结果仅供初筛，投资决策前应使用现场或权威长期数据复核。',
  };
}
