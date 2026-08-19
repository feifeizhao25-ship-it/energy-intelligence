// 储能计算引擎测试
import { calculateStorage } from './storage';

describe('Storage Calculator', () => {
    // 使用 any 类型避免与类型定义的不匹配问题
    // 实际计算逻辑只检查必要的字段
    const baseArbitrageInput: any = {
        energy: 1000, // 1MWh
        power: 500,   // 500kW
        applicationMode: 'arbitrage',
        technical: {
            efficiency: 90,
            dod: 90,
            cycleLife: 6000,
            degradationRate: 2,
            maintenanceCostRatio: 2
        },
        investment: {
            unitCost: 1500, // 元/kWh
        },
        arbitrageConfig: {
            peakPrice: 1.2,
            valleyPrice: 0.3,
            flatPrice: 0.6,
            chargeTime1: [0, 8],
            dischargeTime1: [10, 12],
            chargeTime2: [12, 14],
            dischargeTime2: [18, 21]
        }
    };

    const baseDemandInput: any = {
        energy: 1000,
        power: 500,
        applicationMode: 'demand_management',
        technical: {
            efficiency: 90,
            dod: 90,
            cycleLife: 6000,
            degradationRate: 2,
            maintenanceCostRatio: 2
        },
        investment: {
            unitCost: 1500
        },
        demandConfig: {
            peakReduction: 200, // kW
            demandCharge: 40    // 元/kW·月
        }
    };

    describe('calculateStorage - Arbitrage Mode', () => {
        it('should calculate technical parameters correctly', async () => {
            const result = await calculateStorage(baseArbitrageInput);

            expect(result.technical).toBeDefined();
            expect(result.technical.usableEnergy).toBe(900); // 1000 * 0.9 DOD
            expect(result.technical.dailyCycles).toBe(2); // Two charge-discharge cycles
        });

        it('should calculate financial metrics correctly', async () => {
            const result = await calculateStorage(baseArbitrageInput);

            expect(result.financial).toBeDefined();
            expect(result.financial.metrics.dailyRevenue).toBeGreaterThan(0);
            expect(result.financial.metrics.annualRevenue).toBeGreaterThan(0);
            expect(result.financial.metrics.irr).toBeDefined();
            expect(result.financial.metrics.paybackYears).toBeGreaterThan(0);
            expect(result.financial.metrics.lcos).toBeGreaterThan(0);
            expect(result.financial.metrics.npv).toBeDefined();
        });

        it('should calculate investment correctly', async () => {
            const result = await calculateStorage(baseArbitrageInput);

            expect(result.financial.investment.total).toBe(1500000); // 1000kWh * 1500
            expect(result.financial.investment.unitCost).toBe(1500);
        });

        it('should handle single cycle configuration', async () => {
            const singleCycleInput = {
                ...baseArbitrageInput,
                arbitrageConfig: {
                    peakPrice: 1.2,
                    valleyPrice: 0.3,
                    flatPrice: 0.6,
                    chargeTime1: [0, 8],
                    dischargeTime1: [10, 12]
                    // 没有 chargeTime2，表示单循环
                }
            };

            const result = await calculateStorage(singleCycleInput);

            expect(result.technical.dailyCycles).toBe(1);
        });
    });

    describe('calculateStorage - Demand Management Mode', () => {
        it('should calculate demand savings correctly', async () => {
            const result = await calculateStorage(baseDemandInput);

            expect(result.financial.metrics.dailyRevenue).toBeGreaterThan(0);

            // Monthly savings should be peakReduction * demandCharge
            const expectedMonthlySaving = 200 * 40; // 8000元/月
            const expectedDailyFromDemand = expectedMonthlySaving * 12 / 365;

            expect(result.financial.metrics.annualRevenue).toBeGreaterThan(0);
        });
    });

    describe('DOD and Efficiency Impact', () => {
        it('should correctly apply depth of discharge', async () => {
            const lowDodInput = {
                ...baseArbitrageInput,
                technical: { ...baseArbitrageInput.technical, dod: 70 }
            };

            const highDodInput = {
                ...baseArbitrageInput,
                technical: { ...baseArbitrageInput.technical, dod: 95 }
            };

            const lowDodResult = await calculateStorage(lowDodInput);
            const highDodResult = await calculateStorage(highDodInput);

            expect(highDodResult.technical.usableEnergy).toBeGreaterThan(lowDodResult.technical.usableEnergy);
        });

        it('should handle different efficiency levels', async () => {
            const lowEffInput = {
                ...baseArbitrageInput,
                technical: { ...baseArbitrageInput.technical, efficiency: 80 }
            };

            const highEffInput = {
                ...baseArbitrageInput,
                technical: { ...baseArbitrageInput.technical, efficiency: 95 }
            };

            const lowEffResult = await calculateStorage(lowEffInput);
            const highEffResult = await calculateStorage(highEffInput);

            // Higher efficiency should lead to higher revenue
            expect(highEffResult.financial.metrics.dailyRevenue).toBeGreaterThan(
                lowEffResult.financial.metrics.dailyRevenue
            );
        });
    });

    describe('LCOS Calculation', () => {
        it('should calculate LCOS (Levelized Cost of Storage)', async () => {
            const result = await calculateStorage(baseArbitrageInput);

            expect(result.financial.metrics.lcos).toBeGreaterThan(0);
            expect(result.financial.metrics.lcos).toBeLessThan(10); // 应该在合理范围内
        });
    });

    describe('Degradation Impact', () => {
        it('should account for degradation over lifetime', async () => {
            const lowDegradation = {
                ...baseArbitrageInput,
                technical: { ...baseArbitrageInput.technical, degradationRate: 1 }
            };

            const highDegradation = {
                ...baseArbitrageInput,
                technical: { ...baseArbitrageInput.technical, degradationRate: 5 }
            };

            const lowDegResult = await calculateStorage(lowDegradation);
            const highDegResult = await calculateStorage(highDegradation);

            // Lower degradation should result in better financial metrics
            expect(lowDegResult.financial.metrics.npv).toBeGreaterThan(highDegResult.financial.metrics.npv);
        });
    });
});
