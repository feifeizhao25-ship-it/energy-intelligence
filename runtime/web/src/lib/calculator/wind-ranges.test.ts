import { calculateWind } from './wind';

jest.mock('@/lib/api/nasa-power', () => ({
    getWindResource: jest.fn(async () => ({
        annual: { avgSpeed: 7, powerDensity: 350 },
        monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, speed50m: 7, powerDensity: 350 })),
    })),
}));

describe('审计 3-2 风电区间（±15%）', () => {
    it('发电量、IRR、LCOE 都给区间，中值与单点结果一致', async () => {
        const r: any = await calculateWind({
            lat: 40, lng: 110, province: '内蒙古', projectName: 't',
            turbine: { type: 'custom', capacity: 3, count: 2, hubHeight: 100, rotorDiameter: 140, cutInSpeed: 3, ratedSpeed: 11, cutOutSpeed: 25 },
            businessModel: { mode: 'full_export', feedInTariff: 0.3 },
            investment: { unitCost: 4500 },
            operation: {},
        } as any);
        expect(r.ranges.year1Generation.median).toBe(r.energy.year1);
        expect(r.ranges.year1Generation.low).toBeCloseTo(r.energy.year1 * 0.85, 6);
        expect(r.ranges.lcoe.median).toBe(r.financial.lcoe);
        expect(r.ranges.irr.median).toBe(r.financial.irr);
        if (r.financial.irr !== null) {
            expect(r.ranges.irr.high).toBeGreaterThan(r.financial.irr);
        }
        expect(r.ranges.year1Generation.note).toContain('测风塔');
    });
});
