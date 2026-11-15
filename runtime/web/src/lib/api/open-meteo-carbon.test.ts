import { fallbackCarbonIntensity } from './open-meteo';

describe('碳排放强度回退用手算的表 3 或全国平均', () => {
    it('江苏 0.5827 kg/kWh = 582.7 g/kWh，并标明省级口径', () => {
        const factor = fallbackCarbonIntensity('江苏省');
        expect(factor.intensity).toBeCloseTo(582.7, 6);
        expect(factor.province).toBe('江苏');
        expect(factor.scope).toBe('江苏省级电力平均二氧化碳排放因子');
        expect(factor.source).toContain('江苏省级');
        expect(factor.source).toContain('2025 年第 47 号');
    });

    it('不填省份为 530.6 g/kWh，标明全国平均', () => {
        const factor = fallbackCarbonIntensity();
        expect(factor.intensity).toBeCloseTo(530.6, 6);
        expect(factor.province).toBeNull();
        expect(factor.scope).toContain('全国');
        expect(factor.source).toContain('全国电力平均');
    });
});
