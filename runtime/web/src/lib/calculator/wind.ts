// 分散式风电收益计算引擎
import { getWindResource } from '@/lib/api/nasa-power';
import { WindCalculationInput } from '@/types';
import { solveIrr, DEFAULT_DISCOUNT_RATE, discountedLcoe } from './project-finance';
import { extrapolateWindSpeed } from './wind-shear';

/** 标准空气密度（kg/m³，海平面 15℃） */
export const STANDARD_AIR_DENSITY = 1.225;

/** 按海拔（m）与年均气温（℃）修正空气密度：气压按指数大气（标高 8434 m），理想气体温度修正 */
export function airDensityAt(elevationM = 0, temperatureC = 15): number {
  const pressureRatio = Math.exp(-Math.max(0, elevationM) / 8434);
  return STANDARD_AIR_DENSITY * pressureRatio * (288.15 / (273.15 + temperatureC));
}

/** Gamma 函数（Lanczos 近似），用于由均值求 Weibull 尺度参数 c */
function gamma(z: number): number {
  const g = 7;
  const p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

/**
 * 通用功率曲线（标幺）：切入—额定之间按 v³ 增长并做空气密度修正，额定—切出满发，其余为 0。
 * 未接入厂商功率曲线时使用；密度低于标准时达到额定所需风速相应提高。
 */
export function genericPowerCurve(v: number, vIn: number, vRated: number, vOut: number, densityRatio = 1): number {
  if (v < vIn || v >= vOut) return 0;
  if (v >= vRated) return 1;
  const p = densityRatio * (Math.pow(v, 3) - Math.pow(vIn, 3)) / (Math.pow(vRated, 3) - Math.pow(vIn, 3));
  return Math.min(1, Math.max(0, p));
}

/**
 * 容量因子 = ∫ 功率曲线(v) × Weibull(k, c) 概率密度 dv（数值积分，步长 0.1 m/s）。
 * 此前固定 k=2，并在切入—额定区间乘常数 0.45，忽略了功率曲线形状（审计 1-5）。
 */
export function estimateCapacityFactor(
  vAvg: number, vIn: number, vRated: number, vOut: number,
  opts: { weibullK?: number; airDensity?: number; powerCurve?: (v: number) => number } = {},
): number {
  if (!(vAvg > 0)) return 0;
  const k = opts.weibullK ?? 2.0;
  const c = vAvg / gamma(1 + 1 / k);
  const densityRatio = (opts.airDensity ?? STANDARD_AIR_DENSITY) / STANDARD_AIR_DENSITY;
  const curve = opts.powerCurve ?? ((v: number) => genericPowerCurve(v, vIn, vRated, vOut, densityRatio));
  const dv = 0.1;
  let cf = 0;
  for (let v = dv / 2; v < Math.max(vOut, 40); v += dv) {
    const pdf = (k / c) * Math.pow(v / c, k - 1) * Math.exp(-Math.pow(v / c, k));
    cf += curve(v) * pdf * dv;
  }
  return cf;
}

export function windSelfUseRatio(raw: unknown, fallback = 0.8): number {
  const value = typeof raw === 'number' ? raw : raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  const ratio = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, ratio));
}

export async function calculateWind(input: WindCalculationInput) {
  // 电价不再写死（原来上网 0.4、自用 0.6 元/度）：由接口层按省级电价表或用户输入给出（lib/pricing/tariff-defaults.ts）
  const fitInput = input.businessModel.feedInTariff;
  if (typeof fitInput !== 'number' || !Number.isFinite(fitInput) || fitInput < 0) {
    throw new Error('缺少上网电价，请选择省份或填写上网电价（机制电价或合同价）');
  }
  if (input.businessModel.mode !== 'full_export') {
    const selfPrice = input.businessModel.electricityPrice;
    if (typeof selfPrice !== 'number' || !Number.isFinite(selfPrice) || selfPrice < 0) {
      throw new Error('缺少自用电价，请选择省份或填写自用电价');
    }
  }
  const windResource = await getWindResource(input.lat, input.lng);
  const totalCapacityKW = input.turbine.capacity * input.turbine.count * 1000;

  const airDensity = airDensityAt(input.elevation ?? 0, input.annualMeanTemperature ?? 15);
  // 轮毂高度风速：由 NASA POWER 的 50 米风速（WS50M）按对数律外推
  const monthlyGeneration = windResource.monthly.map(m => {
    const vHub = extrapolateWindSpeed(m.speed50m, 50, input.turbine.hubHeight);
    const cf = estimateCapacityFactor(vHub, input.turbine.cutInSpeed, input.turbine.ratedSpeed, input.turbine.cutOutSpeed, {
      weibullK: input.turbine.weibullK,
      airDensity,
    });
    const days = new Date(2024, m.month, 0).getDate();
    return {
      month: m.month,
      speed: vHub,
      generation: totalCapacityKW * 24 * days * cf
        * (input.operation.availability ?? 0.97)
        * (1 - ((input.operation.wakeLoss ?? 5) / 100))
        * (1 - ((input.operation.otherLosses ?? 3) / 100))
    };
  });

  const year1Generation = monthlyGeneration.reduce((sum, m) => sum + m.generation, 0);
  if (!(year1Generation > 0)) {
    // 此前发电量为 0 时在 LCOE 处抛出看不懂的 INVALID_LCOE_INPUT
    throw new Error('轮毂高度月均风速均低于切入风速，测算发电量为 0，请检查风机参数或轮毂高度');
  }
  const equivalentHours = year1Generation / totalCapacityKW;
  const years = input.operation.operationYears ?? 20;
  const lifetimeGeneration = Array.from({ length: years }, (_, i) => year1Generation * Math.pow(0.998, i));

  // 单位造价按 元/kW 计。
  const calcInvestment = input.investment.totalInvestment ?? totalCapacityKW * (input.investment.unitCost ?? 5500);

  // 自用比例统一为 0–1 小数：>1 视为百分数（80 → 0.8），截断到 [0, 1]。
  // 此前 /api/calculate/wind 直接传入 80，自用电量 = 80 × 发电量、上网电量为负。
  const selfUseRatio = windSelfUseRatio(input.businessModel.selfUseRatio);
  const cashFlows: number[] = [-calcInvestment];
  const annualRevenues: number[] = [];
  const annualCosts: number[] = []; // 运维 + 保险（计入 LCOE）
  for (let year = 1; year <= years; year++) {
    const gen = lifetimeGeneration[year - 1];
    let revenue = 0;
    const price = input.businessModel.electricityPrice as number;
    const fit = input.businessModel.feedInTariff as number;

    if (input.businessModel.mode === 'full_export') {
      revenue = gen * fit;
    } else {
      const selfUse = gen * selfUseRatio;
      revenue = selfUse * price + (gen - selfUse) * fit;
    }

    const omCost = (input.operation.omCostPerMW ?? 15) * (totalCapacityKW / 1000) * 10000;
    const insurance = calcInvestment * (input.operation.insuranceRate ?? 0.003);

    let villageShare = 0;
    if (input.businessModel.cooperationMode === 'revenue_share') {
      villageShare = revenue * (input.businessModel.cooperation?.revenueShareRatio ?? 5) / 100;
    }

    annualRevenues.push(revenue);
    annualCosts.push(omCost + insurance);
    cashFlows.push(revenue - omCost - insurance - villageShare);
  }

  // LCOE（口径库 STANDARDS.LCOE）：[投资 + Σ (运维+保险)_t/(1+r)^t] / Σ [发电量_t/(1+r)^t]，r = 8%。
  // 此前只算「投资 ÷ 总发电量」，既没计运维也没折现。村集体分成属于收益分配，不计入度电成本。
  const lcoe = discountedLcoe({
    initialInvestment: calcInvestment,
    annualCosts,
    annualGeneration: lifetimeGeneration,
    discountRate: DEFAULT_DISCOUNT_RATE,
  });

  return {
    energy: {
      year1: year1Generation,
      monthly: monthlyGeneration.map(m => m.generation),
      lifetime: lifetimeGeneration.reduce((a, b) => a + b, 0),
      equivalentHours,
      capacityFactor: (equivalentHours / 8760) * 100
    },
    financial: {
      investment: calcInvestment,
      year1Revenue: annualRevenues[0], // 首年售电/自用收入（未扣运维、保险）
      irr: irrPercent(cashFlows),
      paybackYears: calculatePaybackPeriod(calcInvestment, cashFlows.slice(1)),
      lcoe,
      discountRate: DEFAULT_DISCOUNT_RATE
    },
    assumptions: [
      `风速分布：Weibull k=${input.turbine.weibullK ?? 2}（未提供实测时默认瑞利分布）`,
      input.turbine.model ? `功率曲线：通用 v³ 曲线（尚未接入 ${input.turbine.model} 厂商曲线）` : '功率曲线：通用 v³ 曲线（未接入厂商曲线）',
      `空气密度：${airDensity.toFixed(3)} kg/m³（海拔 ${input.elevation ?? 0} m、年均气温 ${input.annualMeanTemperature ?? 15}℃ 修正）`,
      '结果为 P50 估计：卫星再分析数据（NASA POWER 约 0.5° 网格月均值）仅适合初筛，不能替代测风塔，不确定度通常在 ±15% 以上',
    ],
  };
}

function calculatePaybackPeriod(initialInvestment: number, annualCashFlows: number[]): number {
  let remaining = initialInvestment;
  for (let year = 0; year < annualCashFlows.length; year++) {
    remaining -= annualCashFlows[year];
    if (remaining <= 0) return year + 1 + remaining / annualCashFlows[year];
  }
  return 20;
}

/** 唯一 IRR（%）；无解/多解返回 null，不伪造数值 */
function irrPercent(cashFlows: number[]): number | null {
  const r = solveIrr(cashFlows);
  return r === null ? null : r * 100;
}
