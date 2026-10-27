import { calculateCharging } from './charging';

it('充电电费只按给定假设相乘', () => {
  const result = calculateCharging({ sessions: 10, kwhPerSession: 30, electricityPriceYuanPerKwh: 0.6, serviceFeeYuanPerSession: 2 });
  expect(result).toMatchObject({ energyKwh: 300, electricityCostYuan: 180, serviceFeeYuan: 20, totalYuan: 200 });
  expect(result.assumptions.join('')).toMatch(/不是投资结论/);
  expect(() => calculateCharging({ sessions: 0, kwhPerSession: 1, electricityPriceYuanPerKwh: 1, serviceFeeYuanPerSession: 0 })).toThrow(/大于 0/);
});
