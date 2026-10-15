import { TARIFFS, tariffDisclosure, unverifiedPriceProvinceCount, provincesWithPrices } from './tariffs';

describe('电价来源披露', () => {
    it('每个省份都有来源、核验状态；未核实的标「来源待核实」', () => {
        for (const t of Object.values(TARIFFS)) {
            const d = tariffDisclosure(t, new Date('2026-10-15'));
            expect(d.source.length).toBeGreaterThan(0);
            expect(d.sourceStatus).toBe(t.sourceVerified ? '来源已核实' : '来源待核实');
            if (t.touStatus === 'fixed') {
                expect(d.asOf).not.toBeNull();
                expect(d.freshness.stale).toBe(true); // 2025 年数据到 2026-10 已超 90 天
            }
        }
    });
    it('首页统计如实计数未核实省份', () => {
        expect(unverifiedPriceProvinceCount()).toBeLessThanOrEqual(provincesWithPrices().length);
        expect(unverifiedPriceProvinceCount()).toBe(provincesWithPrices().filter(p => !TARIFFS[p].sourceVerified).length);
    });
});
