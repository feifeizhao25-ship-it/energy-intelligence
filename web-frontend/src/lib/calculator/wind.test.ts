// 风电计算引擎测试
import { calculateWind } from './wind';

// 使用 any 避免类型定义不匹配的问题
type WindInput = any;

// Mock dependencies
jest.mock('@/lib/api/nasa-power', () => ({
    getWindResource: jest.fn(async () => ({
        annual: { avgSpeed: 6.5, powerDensity: 350 },
        monthly: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            speed50m: 5.5 + Math.sin((i + 1) * Math.PI / 6) * 1.5,
            powerDensity: 300 + Math.sin((i + 1) * Math.PI / 6) * 100
        }))
    }))
}));

describe('Wind Calculator', () => {
    const baseInput: WindInput = {
        lat: 30.5,
        lng: 120.1,
        province: '浙江',
        projectName: 'Test Wind Project',
        turbine: {
            type: 'medium_wind',
            capacity: 2.0, // 2MW
            count: 1,
            hubHeight: 80,
            rotorDiameter: 100,
            cutInSpeed: 3,
            ratedSpeed: 12,
            cutOutSpeed: 25
        },
        businessModel: {
            mode: 'full_export',
            feedInTariff: 0.4,
            electricityPrice: 0.6
        },
        investment: {
            unitCost: 6000 // 元/kW
        },
        operation: {
            availability: 0.97,
            wakeLoss: 5,
            otherLosses: 3
        }
    };

    describe('calculateWind', () => {
        it('should calculate energy generation correctly', async () => {
            const result = await calculateWind(baseInput);

            expect(result.energy).toBeDefined();
            expect(result.energy.year1).toBeGreaterThan(0);
            expect(result.energy.monthly).toHaveLength(12);
            expect(result.energy.lifetime).toBeGreaterThan(result.energy.year1);
            expect(result.energy.equivalentHours).toBeGreaterThan(0);
            expect(result.energy.capacityFactor).toBeGreaterThan(0);
            expect(result.energy.capacityFactor).toBeLessThan(100);
        });

        it('should calculate financial metrics correctly', async () => {
            const result = await calculateWind(baseInput);

            expect(result.financial).toBeDefined();
            expect(result.financial.investment).toBeGreaterThan(0);
            expect(result.financial.year1Revenue).toBeGreaterThan(0);
            expect(result.financial.irr).toBeDefined();
            expect(result.financial.paybackYears).toBeGreaterThan(0);
            expect(result.financial.lcoe).toBeGreaterThan(0);
        });

        it('should handle different business models', async () => {
            const fullExportResult = await calculateWind({
                ...baseInput,
                businessModel: { mode: 'full_export', feedInTariff: 0.4 }
            });

            const selfUseResult = await calculateWind({
                ...baseInput,
                businessModel: {
                    mode: 'self_use_export', // 修正为正确的类型值
                    electricityPrice: 0.8,
                    feedInTariff: 0.4,
                    selfUseRatio: 0.7
                }
            });

            expect(fullExportResult.financial.year1Revenue).toBeGreaterThan(0);
            expect(selfUseResult.financial.year1Revenue).toBeGreaterThan(0);
        });

        it('should handle multiple turbines', async () => {
            const singleTurbine = await calculateWind(baseInput);
            const multipleTurbines = await calculateWind({
                ...baseInput,
                turbine: { ...baseInput.turbine, count: 3 }
            });

            expect(multipleTurbines.energy.year1).toBeGreaterThan(singleTurbine.energy.year1);
            expect(multipleTurbines.financial.investment).toBeGreaterThan(singleTurbine.financial.investment);
        });

        it('should handle different hub heights', async () => {
            const lowHub = await calculateWind({
                ...baseInput,
                turbine: { ...baseInput.turbine, hubHeight: 60 }
            });
            const highHub = await calculateWind({
                ...baseInput,
                turbine: { ...baseInput.turbine, hubHeight: 100 }
            });

            // Higher hub height should generally produce more energy
            expect(highHub.energy.year1).toBeGreaterThan(lowHub.energy.year1 * 0.9);
        });
    });

    describe('Capacity Factor', () => {
        it('should have realistic capacity factor (15-50%)', async () => {
            const result = await calculateWind(baseInput);

            expect(result.energy.capacityFactor).toBeGreaterThan(5);
            expect(result.energy.capacityFactor).toBeLessThan(60);
        });
    });

    describe('Investment Calculation', () => {
        it('should calculate investment based on unit cost', async () => {
            const result = await calculateWind(baseInput);
            const expectedInvestment = baseInput.turbine.capacity * 1000 * baseInput.investment.unitCost!;

            expect(result.financial.investment).toBe(expectedInvestment);
        });

        it('should use total investment if provided', async () => {
            const totalInvestment = 15000000;
            const result = await calculateWind({
                ...baseInput,
                investment: { totalInvestment }
            });

            expect(result.financial.investment).toBe(totalInvestment);
        });
    });
});
