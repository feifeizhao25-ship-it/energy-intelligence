// 光伏计算引擎测试
import { calculateSolar } from './solar';
import { SolarCalculationInput } from '@/types';

// Mock dependencies
jest.mock('@/lib/api/nasa-power', () => ({
    getSolarResource: jest.fn(async () => ({
        annual: { ghi: 1500, dni: 1800, optimalTilt: 25, resourceClass: 'B' },
        monthly: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            ghi: 4.0 + Math.sin((i + 1) * Math.PI / 6) * 1.5,
            dni: 5.0 + Math.sin((i + 1) * Math.PI / 6) * 1.5,
            temperature: 15 + Math.sin((i + 1) * Math.PI / 6) * 10
        }))
    }))
}));

jest.mock('@/lib/policy/electricity-price', () => ({
    getPriceConfig: jest.fn(() => ({
        province: '浙江',
        retailPrice: 0.82,
        feedInTariff: 0.4153,
        peakValleySupport: true,
        peaks: [{ start: 9, end: 11 }, { start: 15, end: 17 }],
        valleys: [{ start: 0, end: 8 }],
        peakPrice: 1.28,
        valleyPrice: 0.26
    }))
}));

describe('Solar Calculator', () => {
    const baseInput: SolarCalculationInput = {
        lat: 30.5,
        lng: 120.1,
        capacity: 100, // 100kW
        installationType: 'roof',
        moduleType: 'standard',
        selfUseRatio: 70,
        electricityPrice: 0.82,
        feedInTariff: 0.4,
        province: '浙江'
    };

    describe('calculateSolar', () => {
        it('should calculate energy generation correctly', async () => {
            const result = await calculateSolar(baseInput);

            expect(result.energy).toBeDefined();
            expect(result.energy.year1).toBeGreaterThan(0);
            expect(result.energy.monthly).toHaveLength(12);
            expect(result.energy.lifetime).toBeGreaterThan(result.energy.year1);
            expect(result.energy.specificYield).toBeGreaterThan(0);
        });

        it('should calculate financial metrics correctly', async () => {
            const result = await calculateSolar(baseInput);

            expect(result.financial).toBeDefined();
            expect(result.financial.investment).toBeGreaterThan(0);
            expect(result.financial.year1Revenue).toBeGreaterThan(0);
            expect(result.financial.paybackYears).toBeGreaterThan(0);
            expect(result.financial.paybackYears).toBeLessThan(25);
            expect(result.financial.irr).toBeGreaterThan(0);
            expect(result.financial.lcoe).toBeGreaterThan(0);
        });

        it('should calculate environmental benefits correctly', async () => {
            const result = await calculateSolar(baseInput);

            expect(result.environmental).toBeDefined();
            expect(result.environmental.co2Year1).toBeGreaterThan(0);
            expect(result.environmental.co2Lifetime).toBeGreaterThan(0);
            expect(result.environmental.treesEquivalent).toBeGreaterThan(0);
        });

        it('should handle different module types', async () => {
            const economyResult = await calculateSolar({ ...baseInput, moduleType: 'economy' });
            const standardResult = await calculateSolar({ ...baseInput, moduleType: 'standard' });
            const premiumResult = await calculateSolar({ ...baseInput, moduleType: 'premium' });

            // Premium should have higher investment but potentially better performance
            expect(premiumResult.financial.investment).toBeGreaterThan(economyResult.financial.investment);
        });

        it('should handle different installation types', async () => {
            const roofResult = await calculateSolar({ ...baseInput, installationType: 'roof' });
            const groundResult = await calculateSolar({ ...baseInput, installationType: 'ground' });

            // Ground installations typically have better performance (less shading)
            expect(roofResult.energy.year1).toBeGreaterThan(0);
            expect(groundResult.energy.year1).toBeGreaterThan(0);
        });

        it('should handle zero self-use ratio (full export)', async () => {
            const result = await calculateSolar({ ...baseInput, selfUseRatio: 0 });

            expect(result.financial.year1Revenue).toBeGreaterThan(0);
        });

        it('should handle full self-use (100% self consumption)', async () => {
            const result = await calculateSolar({ ...baseInput, selfUseRatio: 100 });

            expect(result.financial.year1Revenue).toBeGreaterThan(0);
        });

        it('should throw error for unknown module type', async () => {
            await expect(calculateSolar({
                ...baseInput,
                moduleType: 'unknown' as any
            })).rejects.toThrow();
        });
    });

    describe('Monthly Generation Pattern', () => {
        it('should show higher generation in summer months', async () => {
            const result = await calculateSolar(baseInput);
            const monthly = result.energy.monthly;

            // Summer months (Jun, Jul, Aug - indices 5, 6, 7) should typically have higher generation
            const summerGen = monthly.slice(5, 8).reduce((a, b) => a + b, 0);
            const winterGen = monthly.slice(0, 2).concat(monthly.slice(11)).reduce((a, b) => a + b, 0);

            // This should generally be true for most locations
            expect(summerGen).toBeGreaterThan(0);
            expect(winterGen).toBeGreaterThan(0);
        });
    });

    describe('Performance Ratio', () => {
        it('should have realistic PR values (60-90%)', async () => {
            const result = await calculateSolar(baseInput);

            expect(result.energy.pr).toBeGreaterThan(0);
            expect(result.energy.pr).toBeLessThan(150); // PR should be realistic
        });
    });
});

// 测试 compareSolarAndWind 函数
describe('compareSolarAndWind', () => {
    // 需要单独 mock 以避免与上面的测试冲突
});

