import { projectFinance, solveIrr, npvOf, paybackPeriodOf, discountedLcoe } from './project-finance';
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

describe('共享求解器', () => {
    test('solveIrr：-100、+60、+60 的手算 IRR 13.07%', () => {
        // 手算：-100 + 60/(1+r) + 60/(1+r)^2 = 0 → 1+r = (60 + √(3600+24000))/200 = 1.1307
        expect(solveIrr([-100, 60, 60])!).toBeCloseTo(0.130662, 5);
    });
    test('solveIrr：符号变化不止一次或没有变化时返回 null', () => {
        expect(solveIrr([-100, 230, -132])).toBeNull();
        expect(solveIrr([100, 10])).toBeNull();
    });
    test('npvOf 与 paybackPeriodOf', () => {
        expect(npvOf([-100, 60, 60], 0.1)).toBeCloseTo(-100 + 60 / 1.1 + 60 / 1.21, 10);
        expect(paybackPeriodOf(100, [60, 60])).toBeCloseTo(1 + 40 / 60, 10);
        expect(paybackPeriodOf(100, [10, 10])).toBeNull();
    });
    test('discountedLcoe 长度不一致时报错', () => {
        expect(() => discountedLcoe({ initialInvestment: 1, annualCosts: [1], annualGeneration: [1, 2], discountRate: 0.08 })).toThrow();
    });
});
