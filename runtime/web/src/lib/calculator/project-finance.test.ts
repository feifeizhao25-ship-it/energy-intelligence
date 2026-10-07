import { solveIrr, npvOf, paybackPeriodOf, discountedLcoe } from './project-finance';

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
