/** 充电桩电量与电费测算。电价、服务费和电量都由调用方给出，不预测利用率。 */

export interface ChargingInput {
  sessions: number;
  kwhPerSession: number;
  electricityPriceYuanPerKwh: number;
  serviceFeeYuanPerSession: number;
}

export function calculateCharging(input: ChargingInput) {
  const fields = [input.sessions, input.kwhPerSession, input.electricityPriceYuanPerKwh, input.serviceFeeYuanPerSession];
  if (fields.some((value) => !Number.isFinite(value) || value < 0) || input.sessions === 0 || input.kwhPerSession === 0) {
    throw new Error('次数、每次电量必须大于 0，电价和服务费不能为负');
  }
  const energyKwh = input.sessions * input.kwhPerSession;
  const electricityCost = energyKwh * input.electricityPriceYuanPerKwh;
  const serviceFee = input.sessions * input.serviceFeeYuanPerSession;
  return {
    energyKwh: round(energyKwh),
    electricityCostYuan: round(electricityCost),
    serviceFeeYuan: round(serviceFee),
    totalYuan: round(electricityCost + serviceFee),
    formula: '电量 = 次数 × 每次电量；电费 = 电量 × 电价；服务费 = 次数 × 单次服务费',
    assumptions: [
      '次数、每次电量和电价都是调用方假设，不是预测的充电需求或电价。',
      '未计入需量电费、力调、损耗和设备投资。',
      '结果是费用测算，不是投资结论。',
    ],
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
