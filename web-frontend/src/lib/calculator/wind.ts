// 分散式风电收益计算引擎
import { getWindResource } from '@/lib/api/nasa-power';
import { WindCalculationInput } from '@/types';

// 辅助函数：外推风速
function extrapolateWindSpeed(vRef: number, hRef: number, hTarget: number, z0: number = 0.03): number {
  return vRef * (Math.log(hTarget / z0) / Math.log(hRef / z0));
}

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

export async function calculateWind(input: WindCalculationInput) {
  const windResource = await getWindResource(input.lat, input.lng);
  const totalCapacityKW = input.turbine.capacity * input.turbine.count * 1000;

  const hubHeightSpeed = extrapolateWindSpeed(windResource.annual.avgSpeed, 100, input.turbine.hubHeight);

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
  const equivalentHours = year1Generation / totalCapacityKW;
  const years = input.operation.operationYears ?? 20;
  const lifetimeGeneration = Array.from({ length: years }, (_, i) => year1Generation * Math.pow(0.998, i));

  const totalInvestment = input.investment.totalInvestment ?? totalCapacityKW * (input.investment.unitCost ?? 5500) / 1000 * 1000;
  // Wait, unit cost is usually Yuan/kW.
  const calcInvestment = input.investment.totalInvestment ?? totalCapacityKW * (input.investment.unitCost ?? 5500);

  const cashFlows: number[] = [-calcInvestment];
  for (let year = 1; year <= years; year++) {
    const gen = lifetimeGeneration[year - 1];
    let revenue = 0;
    const price = input.businessModel.electricityPrice ?? 0.6;
    const fit = input.businessModel.feedInTariff ?? 0.4;

    if (input.businessModel.mode === 'full_export') {
      revenue = gen * fit;
    } else {
      const selfUse = gen * (input.businessModel.selfUseRatio ?? 0.8);
      revenue = selfUse * price + (gen - selfUse) * fit;
    }

    const omCost = (input.operation.omCostPerMW ?? 15) * (totalCapacityKW / 1000) * 10000;
    const insurance = calcInvestment * (input.operation.insuranceRate ?? 0.003);

    let villageShare = 0;
    if (input.businessModel.cooperationMode === 'revenue_share') {
      villageShare = revenue * (input.businessModel.cooperation?.revenueShareRatio ?? 5) / 100;
    }

    cashFlows.push(revenue - omCost - insurance - villageShare);
  }

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
      year1Revenue: cashFlows[1] + (calcInvestment * (input.operation.insuranceRate ?? 0.003)), // Gross revenue roughly
      irr: calculateIRR(cashFlows) * 100,
      paybackYears: calculatePaybackPeriod(calcInvestment, cashFlows.slice(1)),
      lcoe: calcInvestment / lifetimeGeneration.reduce((a, b) => a + b, 0)
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
