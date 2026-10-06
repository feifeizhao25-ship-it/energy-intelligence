// 光伏计算引擎
import {
  SolarCalculationInput,
  SolarCalculationOutput,
  SolarResource,
  WindCalculationInput
} from '@/types';
import { getSolarResource } from '@/lib/api/nasa-power';
import { getPriceConfig } from '@/lib/policy/electricity-price';
import { TariffUnavailableError } from '@/lib/pricing/tariffs';
import { calculateWind } from './wind';
import { PolicyService } from '@/lib/services/policy-service';
import { safeErrorMessage } from '@/lib/api/safe-error';
import { DEFAULT_DISCOUNT_RATE, discountedLcoe } from './project-finance';
import { co2AvoidedKg, GRID_EMISSION_FACTOR } from '@/lib/standards/emission-factor';

// 光伏组件配置
interface ModuleConfig {
  efficiency: number; // 组件效率 (%)
  firstYearDegradation: number; // 首年衰减 (%)
  annualDegradation: number; // 年衰减 (%)
  costPerWatt: number; // 成本 (元/W)
}

const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  economy: {
    efficiency: 21.5,
    firstYearDegradation: 2.0,
    annualDegradation: 0.55,
    costPerWatt: 0.85
  },
  standard: {
    efficiency: 22.5,
    firstYearDegradation: 1.5,
    annualDegradation: 0.45,
    costPerWatt: 1.0
  },
  premium: {
    efficiency: 23.5,
    firstYearDegradation: 1.0,
    annualDegradation: 0.4,
    costPerWatt: 1.2
  }
};

// 安装类型修正系数
interface InstallationFactor {
  shadingLoss: number; // 遮挡损失
  mismatchLoss: number; // 失配损失
  dcLoss: number; // DC线损
  inverterEfficiency: number; // 逆变器效率
}

const INSTALLATION_FACTORS: Record<string, InstallationFactor> = {
  roof: {
    shadingLoss: 0.03,
    mismatchLoss: 0.02,
    dcLoss: 0.015,
    inverterEfficiency: 0.96
  },
  ground: {
    shadingLoss: 0.01,
    mismatchLoss: 0.02,
    dcLoss: 0.015,
    inverterEfficiency: 0.97
  },
  carport: {
    shadingLoss: 0.02,
    mismatchLoss: 0.02,
    dcLoss: 0.015,
    inverterEfficiency: 0.96
  },
  bifacial: {
    shadingLoss: 0.01,
    mismatchLoss: 0.02,
    dcLoss: 0.015,
    inverterEfficiency: 0.97
  }
};

/**
 * 系统损耗中安装形式之外的部分（GB 50797 系统效率分项里常见的取值）：
 * - soilingLoss：灰尘/积雪遮挡 2%
 * - acLoss：交流线损与升压变损耗 1.5%
 * - cellTempRise：组件工作温度相对环境温度的平均温升（按辐照加权，约 20°C；NOCT 45°C 时 800 W/m² 下温升 25°C）
 * - tempCoefficient：功率温度系数 0.4%/°C（25°C 以上计损失）
 * 此前只用环境温度、不计灰尘和交流损耗，PR 修正单位后地面电站会超过 90%，与实测不符。
 */
export const LOSS_ASSUMPTIONS = {
  soilingLoss: 0.02,
  acLoss: 0.015,
  cellTempRise: 20,
  tempCoefficient: 0.004,
} as const;

/** 财务假设（结果里通过 assumptions 原样返回，报告文字从这里取，不再另写一套）。 */
export const FINANCE_ASSUMPTIONS = {
  lifetimeYears: 25,
  discountRate: DEFAULT_DISCOUNT_RATE, // NPV 与 LCOE 共用
  omCostRatio: 0.01, // 年运维费 = 初始投资 × 1%
  omEscalation: 0.02, // 运维费每年上涨 2%
} as const;

/**
 * 第 year 年（从 1 起）的发电量相对首年的系数：
 *   第 1 年 = 1；第 n 年（n ≥ 2）= (1 − 首年衰减) × (1 − 年衰减)^(n−2)
 * 发电量序列、现金流、LCOE 都用这一个函数，报告里的衰减描述也按它写。
 */
export function degradationFactor(year: number, firstYearDegradationPct: number, annualDegradationPct: number): number {
  if (year <= 1) return 1;
  return (1 - firstYearDegradationPct / 100) * Math.pow(1 - annualDegradationPct / 100, year - 2);
}

/** STC 辐照度 1 kW/m²：装机容量(kW) × 倾斜面辐照(kWh/m²) ÷ 1 kW/m² = 理论发电量(kWh) */
const G_STC_KW_PER_M2 = 1;

/**
 * 按「倾斜面年辐照 × 装机容量 × 系统效率」计算年发电量（kWh）。
 * 例：1000 kW × 1500 kWh/m² ÷ 1 kW/m² × 0.8 = 1,200,000 kWh。
 */
export function annualEnergyKWh(capacityKw: number, planeIrradiationKWhPerM2: number, systemEfficiency: number): number {
  return capacityKw * (planeIrradiationKWhPerM2 / G_STC_KW_PER_M2) * systemEfficiency;
}

/**
 * 系统性能比 PR（口径库 STANDARDS.PR，IEC 61724-1）：
 *   PR = E_actual / (P_stc × H_poa / G_stc)
 * capacityKw 为 kWp，planeIrradiationKWhPerM2 为组件平面**年累计**辐照（kWh/m²/年），返回 0–1 小数。
 * 注意：H_poa 已是年累计值，不能再乘 365（此前的写法把分母放大了 365 倍，页面上 PR≈0.3%）。
 */
export function performanceRatio(energyKWh: number, capacityKw: number, planeIrradiationKWhPerM2: number): number {
  const reference = capacityKw * (planeIrradiationKWhPerM2 / G_STC_KW_PER_M2);
  if (!(reference > 0)) return 0;
  return energyKWh / reference;
}

/**
 * 自用比例统一口径：**0–1 小数**（0.8 表示 80% 自用）。calculateSolar 只接受小数，
 * 传入百分数（如 80）会直接报错，避免再出现「传 0.8 又除以 100」只按 0.8% 自用算的错误。
 * 接口层若收到百分数，用本函数换算：大于 1 的值视为百分数（80 → 0.8），结果截断到 [0, 1]。
 */
export function normalizeSelfUseRatio(raw: unknown, fallback: number): number {
  const value = typeof raw === 'number' ? raw : raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  const ratio = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, ratio));
}

/**
 * 计算光伏项目收益
 */
export async function calculateSolar(input: SolarCalculationInput): Promise<SolarCalculationOutput> {
  try {
    // 1. 获取太阳能资源数据
    const solarResource = await getSolarResource(input.lat, input.lng);

    // 2. 获取组件配置
    const moduleConfig = MODULE_CONFIGS[input.moduleType];
    if (!moduleConfig) {
      throw new Error(`未知的组件类型: ${input.moduleType}`);
    }
    if (!Number.isFinite(input.selfUseRatio) || input.selfUseRatio < 0 || input.selfUseRatio > 1) {
      throw new Error('自用比例须为 0–1 的小数（例如 0.8 表示 80%）');
    }

    // 3. 获取电价配置和最新政策
    // 只有用户没填电价时才查省级电价表；查不到/已取消固定分时会抛出中文提示，不按其他省份兜底
    const pricingConfig = input.electricityPrice && input.feedInTariff ? null : getPriceConfig(input.province);
    let electricityPrice = input.electricityPrice || pricingConfig!.retailPrice;
    let feedInPrice = input.feedInTariff || pricingConfig!.feedInTariff;
    let subsidies = 0; // 元/kWh 补贴
    let oneTimeSubsidy = 0; // 元/W 一次性补贴

    // 尝试获取动态政策
    try {
      const activePolicies = await PolicyService.getActivePolicies(input.province);

      for (const policy of activePolicies) {
        if (policy.type === 'SUBSIDY_KWH') {
          subsidies += policy.value; // 累加度电补贴
          console.log(`[Policy] Applied kWh subsidy: ${policy.value}元/kWh (${input.province})`);
        } else if (policy.type === 'SUBSIDY_ONE_TIME') {
          // 假设一次性补贴单位是 元/W 或者 元/kW
          if (policy.unit === '元/W') {
            oneTimeSubsidy += policy.value;
          } else if (policy.unit === '元/kW') {
            oneTimeSubsidy += policy.value / 1000;
          }
          console.log(`[Policy] Applied one-time subsidy: ${policy.value}${policy.unit} (${input.province})`);
        } else if (policy.type === 'ELECTRICITY_PRICE') {
          // 如果政策中有明确电价，覆盖默认值（谨慎使用）
          // electricityPrice = policy.value;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch active policies, using defaults', e);
    }

    // 叠加度电补贴
    const effectiveFeedInPrice = feedInPrice + subsidies;
    const effectiveSelfUsePrice = electricityPrice + subsidies; // 自用部分通常也享受度电补贴（视具体政策而定，这里假设全额度电补贴）

    // 4. 计算月度发电量
    const { monthlyGeneration, planeIrradiation } = calculateMonthlyGeneration(
      solarResource,
      input.capacity,
      moduleConfig,
      INSTALLATION_FACTORS[input.installationType],
      input.tilt || solarResource.annual.optimalTilt,
      input.azimuth || 180
    );

    // 5. 计算25年发电量（含衰减）
    const year1Generation = monthlyGeneration.reduce((sum, m) => sum + m, 0);
    const lifetimeGeneration = calculateLifetimeGeneration(
      monthlyGeneration,
      moduleConfig.firstYearDegradation,
      moduleConfig.annualDegradation
    );
    const annualGeneration = lifetimeGeneration.monthly.map(year => year.reduce((a, b) => a + b, 0));

    // 6. 财务分析
    // 初始投资减去一次性补贴
    const initialInvestmentCost = input.unitCost || (moduleConfig.costPerWatt * 1000 + 500);
    const effectiveUnitCost = Math.max(0, initialInvestmentCost - (oneTimeSubsidy * 1000));

    const financial = calculateFinancial(
      input.capacity,
      effectiveUnitCost,
      annualGeneration,
      effectiveSelfUsePrice, // 使用含补贴的电价计算收益
      effectiveFeedInPrice,  // 使用含补贴的上网价计算收益
      input.selfUseRatio // 0–1 小数，见 normalizeSelfUseRatio
    );

    // 7. 环境效益计算
    const environmental = calculateEnvironmentalBenefit(year1Generation, lifetimeGeneration.total);

    return {
      energy: {
        year1: year1Generation,
        monthly: monthlyGeneration,
        lifetime: lifetimeGeneration.total,
        specificYield: year1Generation / input.capacity,
        equivalentHours: year1Generation / input.capacity,
        planeIrradiation,
        pr: performanceRatio(year1Generation, input.capacity, planeIrradiation),
        degradation: lifetimeGeneration.degradation
      },
      financial,
      environmental,
      assumptions: {
        ...FINANCE_ASSUMPTIONS,
        firstYearDegradation: moduleConfig.firstYearDegradation,
        annualDegradation: moduleConfig.annualDegradation,
      },
    };

  } catch (error) {
    console.error('光伏计算失败:', error);
    if (error instanceof TariffUnavailableError) throw error;
    throw new Error(`光伏计算失败: ${safeErrorMessage(error, '未知错误')}`);
  }
}

/**
 * 计算月度发电量
 */
function calculateMonthlyGeneration(
  solarResource: SolarResource,
  capacity: number,
  moduleConfig: ModuleConfig,
  installationFactor: InstallationFactor,
  tilt: number,
  azimuth: number
): { monthlyGeneration: number[]; planeIrradiation: number } {
  const monthlyGeneration: number[] = [];
  let planeIrradiation = 0; // 组件平面年累计辐照 (kWh/m²/年)

  // 系统效率（不含温度，温度逐月计）。不包含组件效率，因为容量已经是 kWp。
  const systemEfficiency =
    (1 - installationFactor.shadingLoss) *
    (1 - installationFactor.mismatchLoss) *
    (1 - installationFactor.dcLoss) *
    installationFactor.inverterEfficiency *
    (1 - LOSS_ASSUMPTIONS.soilingLoss) *
    (1 - LOSS_ASSUMPTIONS.acLoss);

  // 倾角修正系数
  const tiltFactor = calculateTiltFactor(solarResource.annual.optimalTilt, tilt);

  // 方位角修正系数（180度为正南）
  const azimuthFactor = 1 - Math.abs(azimuth - 180) * 0.0003; // 每度偏差0.03%损失

  solarResource.monthly.filter(m => m.month <= 12).forEach(monthData => {
    // 温度修正：按组件工作温度（环境温度 + 平均温升）计，25°C 以上每度损失 0.4%
    const cellTemperature = monthData.temperature + LOSS_ASSUMPTIONS.cellTempRise;
    const tempFactor = 1 - Math.max(0, (cellTemperature - 25) * LOSS_ASSUMPTIONS.tempCoefficient);

    const daysInMonth = new Date(2024, monthData.month, 0).getDate();

    // 组件平面月辐照 (kWh/m²) = 水平面日均辐照 × 天数 × 倾角修正 × 方位角修正
    // 说明：这里没有直射/散射分解与倾斜面换算，倾角只做折减，是对 POA 的近似。
    const monthPlane = monthData.ghi * daysInMonth * tiltFactor * azimuthFactor;
    planeIrradiation += monthPlane;

    // 月发电量(kWh) = 容量(kW) × 组件平面月辐照(kWh/m²) ÷ 1 kW/m² × 系统效率 × 温度修正
    const generation = annualEnergyKWh(capacity, monthPlane, systemEfficiency * tempFactor);

    monthlyGeneration.push(Math.round(generation));
  });

  return { monthlyGeneration, planeIrradiation };
}

/**
 * 计算倾角修正系数
 */
function calculateTiltFactor(optimalTilt: number, actualTilt: number): number {
  const tiltDiff = Math.abs(optimalTilt - actualTilt);
  // 每度偏差损失0.2%
  return Math.max(0.7, 1 - tiltDiff * 0.002);
}

/**
 * 计算25年发电量（含衰减）
 */
function calculateLifetimeGeneration(
  monthlyGeneration: number[],
  firstYearDegradation: number,
  annualDegradation: number
) {
  const years = FINANCE_ASSUMPTIONS.lifetimeYears;
  const monthlyData: number[][] = [];
  const degradation: number[] = [];

  for (let year = 1; year <= years; year++) {
    const yearFactor = degradationFactor(year, firstYearDegradation, annualDegradation);

    degradation.push((1 - yearFactor) * 100);

    const yearGeneration = monthlyGeneration.map(monthly =>
      Math.round(monthly * yearFactor)
    );

    monthlyData.push(yearGeneration);
  }

  const totalGeneration = monthlyData.flat().reduce((sum, gen) => sum + gen, 0);

  return {
    monthly: monthlyData,
    total: totalGeneration,
    degradation
  };
}

function calculateFinancial(
  capacity: number,
  unitCost: number,
  annualGeneration: number[], // 逐年发电量（已含衰减），第 0 项为第 1 年
  electricityPrice: number,
  feedInPrice: number,
  selfUseRatio: number // 0–1 小数
) {
  // 1. 投资成本计算
  // unitCost 是 元/kW
  const totalInvestment = capacity * unitCost;

  // 2. 首年收益：自用部分按自用电价，上网部分按上网电价
  const year1Generation = annualGeneration[0];
  const selfUseGeneration = year1Generation * selfUseRatio;
  const feedInGeneration = year1Generation * (1 - selfUseRatio);
  const blendedPrice = electricityPrice * selfUseRatio + feedInPrice * (1 - selfUseRatio);
  const totalRevenue = year1Generation * blendedPrice;

  // 3. 运维成本：首年为初始投资的 1%，此后每年上涨 2%
  const omCost = totalInvestment * FINANCE_ASSUMPTIONS.omCostRatio;
  const annualOmCosts = annualGeneration.map((_, i) => omCost * Math.pow(1 + FINANCE_ASSUMPTIONS.omEscalation, i));

  // 4. 现金流：逐年发电量与发电量序列同一套衰减（degradationFactor），不再另用 0.992^n
  const annualRevenues = annualGeneration.map(gen => gen * blendedPrice);
  const annualCashFlows = annualRevenues.map((revenue, i) => revenue - annualOmCosts[i]);

  // 5. 计算IRR（内部收益率）
  const irr = calculateIRR(-totalInvestment, annualCashFlows);

  // 6. 计算NPV（净现值）
  const npv = calculateNPV(-totalInvestment, annualCashFlows, FINANCE_ASSUMPTIONS.discountRate);

  // 7. 计算回收期
  const paybackYears = calculatePaybackPeriod(totalInvestment, annualCashFlows);

  // 8. LCOE（口径库 STANDARDS.LCOE）：
  //    [初始投资 + Σ 运维_t/(1+r)^t] / Σ [发电量_t/(1+r)^t]，r = 8%，t = 1..25
  //    此前直接「总成本 ÷ 总发电量」不折现，比折现口径低约一半。
  const lcoe = discountedLcoe({
    initialInvestment: totalInvestment,
    annualCosts: annualOmCosts,
    annualGeneration,
    discountRate: FINANCE_ASSUMPTIONS.discountRate,
  });

  return {
    investment: totalInvestment,
    selfUseEnergy: selfUseGeneration,
    exportEnergy: feedInGeneration,
    year1Revenue: totalRevenue,
    paybackYears,
    irr,
    npv,
    lcoe,
    cashFlow: annualCashFlows, // 逐年净现金流（收入 − 运维），不含第 0 年投资
    revenue: annualRevenues // 逐年收入（未扣运维）
  };
}

/**
 * 计算IRR
 */
function calculateIRR(initialInvestment: number, cashFlow: number[]): number {
  // 简化IRR计算（牛顿法）
  let rate = 0.1; // 初始猜测10%
  const tolerance = 0.0001;
  const maxIterations = 100;

  for (let i = 0; i < maxIterations; i++) {
    let npv = initialInvestment;
    let derivative = 0;

    for (let year = 0; year < cashFlow.length; year++) {
      const factor = Math.pow(1 + rate, year + 1);
      npv += cashFlow[year] / factor;
      derivative -= (year + 1) * cashFlow[year] / Math.pow(1 + rate, year + 2);
    }

    if (Math.abs(npv) < tolerance) {
      return rate * 100;
    }

    rate = rate - npv / derivative;

    if (rate < -0.99) rate = -0.99; // 防止负利率过低
    if (rate > 10) rate = 10; // 防止利率过高
  }

  return rate * 100;
}

/**
 * 计算NPV
 */
function calculateNPV(initialInvestment: number, cashFlow: number[], discountRate: number): number {
  let npv = initialInvestment;

  for (let year = 0; year < cashFlow.length; year++) {
    const presentValue = cashFlow[year] / Math.pow(1 + discountRate, year + 1);
    npv += presentValue;
  }

  return npv;
}

/**
 * 计算回收期
 */
function calculatePaybackPeriod(initialInvestment: number, annualCashFlows: number[]): number {
  let remaining = initialInvestment;

  for (let year = 0; year < annualCashFlows.length; year++) {
    remaining -= annualCashFlows[year];
    if (remaining <= 0) {
      // 线性插值计算更精确的月份
      const prevRemaining = remaining + annualCashFlows[year];
      const fraction = prevRemaining / annualCashFlows[year];
      return year + fraction;
    }
  }

  return 25; // 25年未回收
}

/**
 * 计算环境效益
 */
function calculateEnvironmentalBenefit(year1Generation: number, lifetimeGenerationKWh: number) {
  // 排放因子统一取 lib/standards/emission-factor.ts（2023 年全国电力平均）
  const co2Year1 = co2AvoidedKg(year1Generation);
  const co2Lifetime = co2AvoidedKg(lifetimeGenerationKWh); // 按含衰减的全生命周期发电量

  // 1棵树每年吸收约22kg CO2
  const treesEquivalent = Math.round(co2Lifetime / 22);

  return {
    co2Year1,
    co2Lifetime,
    treesEquivalent,
    emissionFactor: GRID_EMISSION_FACTOR.value,
    emissionFactorYear: GRID_EMISSION_FACTOR.year,
    emissionFactorSource: GRID_EMISSION_FACTOR.source,
  };
}

/**
 * 对比分析：光伏vs风电
 */
export async function compareSolarAndWind(
  lat: number,
  lng: number,
  province: string
) {
  // 统一比较基准：1MW (1000kW)
  const capacity = 1000;

  // 1. 计算光伏
  const solarInput: SolarCalculationInput = {
    lat,
    lng,
    capacity,
    installationType: 'ground',
    moduleType: 'standard',
    selfUseRatio: 1, // 全额自用（对比最大收益潜力），0–1 小数
    electricityPrice: 0.6, // 假设电价
    feedInTariff: 0.4,
    province
  };

  const solarResult = await calculateSolar(solarInput);

  // 2. 计算风电
  const windInput: WindCalculationInput = {
    lat,
    lng,
    province,
    projectName: 'Benchmark Wind',
    turbine: {
      type: 'medium_wind',
      capacity: 1.0, // 1MW
      count: 1,
      hubHeight: 80,
      rotorDiameter: 90,
      cutInSpeed: 3,
      ratedSpeed: 12,
      cutOutSpeed: 25
    },
    businessModel: {
      mode: 'full_export',
      feedInTariff: 0.4
    },
    investment: { unitCost: 8000 },
    operation: {}
  };

  const windResult = await calculateWind(windInput);

  // 3. 获取资源数据用于分析
  const solarResource = await getSolarResource(lat, lng);

  // 4. 生成建议
  const recommendations = generateComparisonRecommendations(
    solarResult,
    windResult,
    solarResource
  );

  return {
    solar: {
      annualGeneration: solarResult.energy.year1,
      irr: solarResult.financial.irr,
      investment: solarResult.financial.investment,
      paybackYears: solarResult.financial.paybackYears
    },
    wind: {
      annualGeneration: windResult.energy.year1,
      irr: windResult.financial.irr,
      investment: windResult.financial.investment,
      paybackYears: windResult.financial.paybackYears
    },
    recommendations
  };
}

/**
 * 生成对比建议
 */
function generateComparisonRecommendations(
  solarResult: SolarCalculationOutput,
  windResult: any,
  solarResource: SolarResource
): string[] {
  const recommendations: string[] = [];

  // 基于IRR比较
  if (solarResult.financial.irr > windResult.financial.irr + 2) {
    recommendations.push('光伏项目IRR更高，投资回报更优');
  } else if (windResult.financial.irr > solarResult.financial.irr + 2) {
    recommendations.push('风电项目IRR更高，投资回报更优');
  } else {
    recommendations.push('光伏和风电IRR相近，可根据其他因素选择');
  }

  // 基于资源条件
  if (solarResource.annual.ghi > 1600) {
    recommendations.push('太阳能资源丰富，适合发展光伏项目');
  }

  if (solarResource.annual.ghi < 1200) {
    recommendations.push('太阳能资源一般，建议考虑风电或其他方案');
  }

  // 基于投资规模
  if (solarResult.financial.investment < windResult.financial.investment) {
    recommendations.push('光伏项目投资门槛较低，适合中小型投资');
  }

  return recommendations;
}
