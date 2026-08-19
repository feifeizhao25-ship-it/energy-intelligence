// 光伏计算引擎
import {
  SolarCalculationInput,
  SolarCalculationOutput,
  SolarResource,
  WindCalculationInput
} from '@/types';
import { getSolarResource } from '@/lib/api/nasa-power';
import { getPriceConfig } from '@/lib/policy/electricity-price';
import { calculateWind } from './wind';
import { PolicyService } from '@/lib/services/policy-service';

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

    // 3. 获取电价配置和最新政策
    const pricingConfig = getPriceConfig(input.province);
    let electricityPrice = input.electricityPrice || pricingConfig.retailPrice;
    let feedInPrice = input.feedInTariff || pricingConfig.feedInTariff;
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
    const monthlyGeneration = calculateMonthlyGeneration(
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

    // 6. 财务分析
    // 初始投资减去一次性补贴
    const initialInvestmentCost = input.unitCost || (moduleConfig.costPerWatt * 1000 + 500);
    const effectiveUnitCost = Math.max(0, initialInvestmentCost - (oneTimeSubsidy * 1000));

    const financial = calculateFinancial(
      input.capacity,
      effectiveUnitCost,
      year1Generation,
      effectiveSelfUsePrice, // 使用含补贴的电价计算收益
      effectiveFeedInPrice,  // 使用含补贴的上网价计算收益
      input.selfUseRatio / 100
    );

    // 7. 环境效益计算
    const environmental = calculateEnvironmentalBenefit(year1Generation);

    return {
      energy: {
        year1: year1Generation,
        monthly: monthlyGeneration,
        lifetime: lifetimeGeneration.total,
        specificYield: year1Generation / input.capacity,
        equivalentHours: year1Generation / input.capacity,
        pr: calculatePerformanceRatio(solarResource, monthlyGeneration, input.capacity),
        degradation: lifetimeGeneration.degradation
      },
      financial,
      environmental
    };

  } catch (error) {
    console.error('光伏计算失败:', error);
    throw new Error(`光伏计算失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
): number[] {
  const monthlyGeneration: number[] = [];

  // 系统效率综合系数 (PR)
  // 不再包含组件效率，因为容量已经是kWp
  const systemEfficiency =
    (1 - installationFactor.shadingLoss) *
    (1 - installationFactor.mismatchLoss) *
    (1 - installationFactor.dcLoss) *
    installationFactor.inverterEfficiency;

  // 倾角修正系数
  const tiltFactor = calculateTiltFactor(solarResource.annual.optimalTilt, tilt);

  // 方位角修正系数（180度为正南）
  const azimuthFactor = 1 - Math.abs(azimuth - 180) * 0.0003; // 每度偏差0.03%损失

  solarResource.monthly.filter(m => m.month <= 12).forEach(monthData => {
    // 温度修正系数
    const tempFactor = 1 - Math.max(0, (monthData.temperature - 25) * 0.004);

    // 月度发电量计算
    // 发电量(kWh) = 辐照量(kWh/m²) × 容量(kW) × 天数 × 系统效率 × 倾角修正 × 方位角修正 × 温度修正
    const daysInMonth = new Date(2024, monthData.month, 0).getDate();

    // 综合系统效率 PR (Performance Ratio)
    // 典型的PR在 75%-85% 之间。systemEfficiency 已经包含了大部分。
    const generation =
      monthData.ghi *
      capacity *
      daysInMonth *
      systemEfficiency *
      tiltFactor *
      azimuthFactor *
      tempFactor;

    monthlyGeneration.push(Math.round(generation));
  });

  return monthlyGeneration;
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
  const years = 25;
  const monthlyData: number[][] = [];
  const degradation: number[] = [];

  for (let year = 0; year < years; year++) {
    const yearFactor =
      year === 0 ?
        (1 - firstYearDegradation / 100) :
        Math.pow(1 - annualDegradation / 100, year);

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
  year1Generation: number,
  electricityPrice: number,
  feedInPrice: number,
  selfUseRatio: number
) {
  // 1. 投资成本计算
  // unitCost 是 元/kW
  const totalInvestment = capacity * unitCost;

  // 2. 年收益计算
  const selfUseGeneration = year1Generation * selfUseRatio;
  const feedInGeneration = year1Generation * (1 - selfUseRatio);

  const selfUseRevenue = selfUseGeneration * electricityPrice;
  const feedInRevenue = feedInGeneration * feedInPrice;
  const totalRevenue = selfUseRevenue + feedInRevenue;

  // 3. 运维成本（年）
  const omCost = totalInvestment * 0.01; // 1% 年运维成本 (修正为更合理的1%)

  // 4. 现金流计算
  const annualCashFlows: number[] = [];

  for (let year = 1; year <= 25; year++) {
    // 考虑组件衰减 (0.5% - 1.0% 每月/年)
    const yearFactor = Math.pow(0.992, year - 1);
    const yearRevenue = totalRevenue * yearFactor;

    // 年度运维成本 (随通胀微增 2%)
    const currentOmCost = omCost * Math.pow(1.02, year - 1);

    const annualProfit = yearRevenue - currentOmCost;
    annualCashFlows.push(annualProfit);
  }

  // 5. 计算IRR（内部收益率）
  const irr = calculateIRR(-totalInvestment, annualCashFlows);

  // 6. 计算NPV（净现值）
  const npv = calculateNPV(-totalInvestment, annualCashFlows, 0.08); // 8%折现率

  // 7. 计算回收期
  const paybackYears = calculatePaybackPeriod(totalInvestment, annualCashFlows);

  // 8. 计算LCOE（平准化度电成本）
  const totalGeneration = year1Generation * 25 * 0.995 ** 12.5; // 平均衰减
  const totalCost = totalInvestment + omCost * 25;
  const lcoe = totalCost / totalGeneration;

  return {
    investment: totalInvestment,
    year1Revenue: totalRevenue,
    paybackYears,
    irr,
    npv,
    lcoe,
    cashFlow: annualCashFlows
  };
}

/**
 * 计算性能比（PR）
 */
function calculatePerformanceRatio(
  solarResource: SolarResource,
  monthlyGeneration: number[],
  capacity: number
): number {
  const totalGeneration = monthlyGeneration.reduce((sum, gen) => sum + gen, 0);
  const expectedGeneration =
    solarResource.annual.ghi *
    capacity *
    365 *
    0.85; // 理论发电量（考虑各种损失）

  return (totalGeneration / expectedGeneration) * 100;
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
function calculateEnvironmentalBenefit(year1Generation: number) {
  // 中国电网平均CO2排放因子：0.785 kgCO2/kWh
  const co2Factor = 0.785;
  const co2Year1 = year1Generation * co2Factor;
  const co2Lifetime = co2Year1 * 25; // 简化为25倍，暂不计算衰减后的精确值

  // 1棵树每年吸收约22kg CO2
  const treesEquivalent = Math.round(co2Lifetime / 22);

  return {
    co2Year1,
    co2Lifetime,
    treesEquivalent
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
    selfUseRatio: 100, // 全额自用（对比最大收益潜力）
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
