import { analyzeIvCurveLocal, computePerformanceRatio, describeInverterCode } from './local-diagnostics';

it('性能比只用调用方给出的电量', () => {
  expect(computePerformanceRatio({ actualKwh: 80, theoreticalKwh: 100 })).toMatchObject({ performanceRatio: 0.8 });
  expect(computePerformanceRatio({ actualKwh: 10, theoreticalKwh: 0 }).performanceRatio).toBeNull();
  expect(computePerformanceRatio({ actualKwh: 80, theoreticalKwh: 100 }).note).not.toMatch(/建议投资|收益承诺/);
});

it('IV 曲线给出填充因子，缺测不补数', () => {
  const result = analyzeIvCurveLocal({
    vocNom: 40, iscNom: 10, vmpNom: 32, impNom: 9,
    vocMeas: 38, iscMeas: 9, vmpMeas: 30, impMeas: 8,
    irradiance: 800, temperature: 25,
  });
  expect(result.fillFactorNominal).toBeCloseTo(0.72, 2);
  expect(result.fillFactorMeasured).toBeCloseTo((30 * 8) / (38 * 9), 3);
  expect(analyzeIvCurveLocal({
    vocNom: 0, iscNom: 10, vmpNom: 32, impNom: 9,
    vocMeas: 38, iscMeas: 9, vmpMeas: 30, impMeas: 8,
    irradiance: 800, temperature: 25,
  }).fillFactorNominal).toBeNull();
});

it('未收录的逆变器代码不会被编成确定故障', () => {
  expect(describeInverterCode('2001', '中午停机').handbookHint).toMatch(/手册/);
  expect(describeInverterCode('9999', '').handbookHint).toMatch(/没有收录/);
});
