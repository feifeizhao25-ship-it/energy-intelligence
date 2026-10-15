// 分散式风电收益计算引擎
import { getWindResource } from '@/lib/api/nasa-power';
import { WindCalculationInput } from '@/types';
import { DEFAULT_DISCOUNT_RATE, discountedLcoe } from './project-finance';
import { extrapolateWindSpeed } from './wind-shear';

// 辅助函数：估算容量因子
function estimateCapacityFactor(vAvg: number, vIn: number, vRated: number, vOut: number): number {
  if (vAvg < vIn) return 0;
  const k = 2.0;
  const c = vAvg / 0.886;
  const pAboveIn = Math.exp(-Math.pow(vIn / c, k));
  const pAboveRated = Math.exp(-Math.pow(vRated / c, k));
  const pAboveOut = Math.exp(-Math.pow(vOut / c, k));
  return (pAboveIn - pAboveRated) * 0.45 + (pAboveRated - pAboveOut);
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

  // 轮毂高度风速：由 NASA POWER 的 50 米风速（WS50M）按对数律外推
  const monthlyGeneration = windResource.monthly.map(m => {
    const vHub = extrapolateWindSpeed(m.speed50m, 50, input.turbine.hubHeight);
    const cf = estimateCapacityFactor(vHub, input.turbine.cutInSpeed, input.turbine.ratedSpeed, input.turbine.cutOutSpeed);
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

  const totalInvestment = input.investment.totalInvestment ?? totalCapacityKW * (input.investment.unitCost ?? 5500) / 1000 * 1000;
  // Wait, unit cost is usually Yuan/kW.
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
      irr: calculateIRR(cashFlows) * 100,
      paybackYears: calculatePaybackPeriod(calcInvestment, cashFlows.slice(1)),
      lcoe,
      discountRate: DEFAULT_DISCOUNT_RATE
    }
  };
}

function calculateIRR(cashFlows: number[]): number {
  let irr = 0.1;
  for (let i = 0; i < 100; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + irr, t);
      dnpv -= t * cashFlows[t] / Math.pow(1 + irr, t + 1);
    }
    const newIrr = irr - npv / dnpv;
    if (Math.abs(newIrr - irr) < 0.0001) return newIrr;
    irr = newIrr;
  }
  return irr;
}

function calculatePaybackPeriod(initialInvestment: number, annualCashFlows: number[]): number {
  let remaining = initialInvestment;
  for (let year = 0; year < annualCashFlows.length; year++) {
    remaining -= annualCashFlows[year];
    if (remaining <= 0) return year + 1 + remaining / annualCashFlows[year];
  }
  return 20;
}
