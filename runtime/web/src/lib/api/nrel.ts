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

export function calculateSolarOutput(
  lat: number,
  lng: number,
  capacityKw: number,
  electricityPrice = 0.5,
  investment?: number,
) {
  const latitudeFactor = Math.max(0.72, 1 - Math.abs(lat - 30) * 0.008);
  const annualEnergyKwh = Math.round(capacityKw * 1350 * latitudeFactor);
  const weights = [0.065, 0.07, 0.085, 0.095, 0.105, 0.11, 0.11, 0.105, 0.09, 0.075, 0.05, 0.04];
  const annualRevenue = annualEnergyKwh * electricityPrice;
  return {
    annualEnergyKwh,
    monthlyEnergyKwh: weights.map((weight) => Math.round(annualEnergyKwh * weight)),
    annualRevenue: Math.round(annualRevenue),
    simplePaybackYears: investment && annualRevenue > 0
      ? Number((investment / annualRevenue).toFixed(1))
      : null,
    capacityFactorPercent: Number(((annualEnergyKwh / (capacityKw * 8760)) * 100).toFixed(2)),
    coordinates: { lat, lng },
    source: 'conservative-estimate',
    warning: '估算结果仅供初筛，投资决策前应使用现场或权威长期数据复核。',
  };
}
