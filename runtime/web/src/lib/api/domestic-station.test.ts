import { nearestDomesticStation, resolveDomesticStation } from './domestic-station';
import { verifiedSolar } from './verified-solar';

describe('国内辐照样本', () => {
    it('省会仍按 0.85 度匹配，原点没有样本', async () => {
        expect(nearestDomesticStation(31.2, 121.5)?.city).toBe('上海');
        expect(nearestDomesticStation(38.97, 115.46)).toBeNull();
        await expect(verifiedSolar(0, 0, new Date('2026-10-27T00:00:00Z'))).rejects.toThrow('DOMESTIC_RESOURCE_NOT_LOADED');
    });

    it('两个省会之间的坐标标明为插值，不是实测', () => {
        const station = resolveDomesticStation(38.97, 115.46);
        expect(station?.city).toBe('插值');
        expect(station?.provenance).toContain('不是该坐标实测');
        expect(station?.license_note).toContain('不是 NASA POWER 实测');
        expect(station?.monthly_daily_ghi).toHaveLength(12);
    });
});
