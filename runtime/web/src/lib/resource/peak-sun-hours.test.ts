/**
 * 地图信息面板把年峰值日照小时标成了 h/天。呼和浩特样本年辐照约 1620 kWh/m²，对应约 1620 h/年。
 */
import { verifiedSolar, toSolarResource } from '@/lib/api/verified-solar';
import { formatPeakSunHours } from './peak-sun-hours';

describe('峰值日照时数单位', () => {
    it('呼和浩特显示年小时，不把 1620 标成每天', async () => {
        const verified = await verifiedSolar(40.84, 111.75, new Date('2026-11-11T00:00:00Z'));
        const solar = toSolarResource(verified, 40.84);
        expect(solar.annual.ghi).toBeCloseTo(1620.01, 2);
        expect(solar.annual.peakSunHours).toBe(solar.annual.ghi);
        const shown = formatPeakSunHours(solar.annual.peakSunHours);
        expect(shown).toEqual({ value: '1620.01', unit: 'h/年' });
        expect(`${shown.value} ${shown.unit}`).not.toContain('h/天');
        expect(solar.annual.peakSunHours / 365).toBeGreaterThan(3);
        expect(solar.annual.peakSunHours / 365).toBeLessThan(6);
    });
});
