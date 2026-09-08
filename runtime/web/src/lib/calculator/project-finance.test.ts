import { projectFinance } from './project-finance';
const base = { initialInvestment: 100, annualGeneration: 100, electricityPrice: 1.2,
    annualOperatingCost: 10, lifetime: 1, degradationRate: 0, discountRate: 0.1 };
test('one year hand calculation includes investment once and all operating costs', () => {
    const result = projectFinance(base);
    expect(result.npv).toBeCloseTo(0, 10);
    expect(result.irr).toBeCloseTo(10, 9);
    expect(result.lcoe).toBeCloseTo(1.2, 10);
    expect(result.paybackPeriod).toBeCloseTo(100 / 110, 10);
    expect(result.cashFlow[0].netCashFlow).toBe(110);
});
test('two year independent discounted cash flow example', () => {
    const result = projectFinance({ ...base, lifetime: 2, electricityPrice: 0.7 });
    expect(result.npv).toBeCloseTo(-100 + 60 / 1.1 + 60 / 1.21, 10);
    expect(result.lcoe).toBeCloseTo((100 + 10 / 1.1 + 10 / 1.21) / (100 / 1.1 + 100 / 1.21), 10);
    expect(result.paybackPeriod).toBeCloseTo(1 + 40 / 60, 10);
    const r = result.irr! / 100;
    expect(-100 + 60 / (1 + r) + 60 / (1 + r) ** 2).toBeCloseTo(0, 8);
});
test('unrecovered investment and nonexistent IRR are null', () => {
    const result = projectFinance({ ...base, electricityPrice: 0 });
    expect(result.irr).toBeNull();
    expect(result.paybackPeriod).toBeNull();
});
test('negative and above 50 percent IRRs are solved rather than clipped', () => {
    expect(projectFinance({ ...base, electricityPrice: 0.6 }).irr).toBeCloseTo(-50);
    expect(projectFinance({ ...base, electricityPrice: 3.1 }).irr).toBeCloseTo(200);
});
test('mixed cash flow signs do not imply a unique IRR', () => {
    expect(projectFinance({ ...base, lifetime: 5, degradationRate: 0.8 }).irr).toBeNull();
});
test.each([NaN, Infinity, -1, 0])('invalid initial investment %s is rejected', value => {
    expect(() => projectFinance({ ...base, initialInvestment: value })).toThrow();
});
test('overflow cannot serialize as a misleading null numeric result', () => {
    expect(() => projectFinance({ ...base, annualGeneration: Number.MAX_VALUE, electricityPrice: 10 })).toThrow('FINANCE_OVERFLOW');
});
