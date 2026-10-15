// POA 换算与 pvlib Perez 逐时复算对照（审计第 1-2 项）：北京 1.186、广州 1.042、乌鲁木齐 1.224
import { poaDaily, empiricalOptimalTilt, monthGeometry } from './transposition';

// NASA POWER 2022 月均日值（ALLSKY_SFC_SW_DWN, ALLSKY_SFC_SW_DIFF，kWh/m²/day），2026-10-15 下载
const DATA: Record<string, { lat: number; ref: number; m: [number, number][] }> = {
    北京: { lat: 39.9, ref: 1.186, m: [[2.2102, 0.9319], [3.2789, 1.1981], [3.9298, 1.5914], [5.5193, 2.346], [6.2333, 2.3758], [5.4194, 2.687], [5.4454, 2.4703], [4.7575, 2.1329], [5.1852, 1.6942], [3.1622, 1.2137], [2.3074, 1.0373], [2.4382, 0.7507]] },
    广州: { lat: 23.13, ref: 1.042, m: [[2.6309, 1.4786], [2.5781, 1.5101], [3.6895, 2.0534], [4.4686, 2.1614], [3.5638, 2.3083], [3.4241, 2.2339], [5.1715, 2.2766], [4.9058, 2.4542], [5.4521, 2.3549], [5.0138, 1.788], [2.4442, 1.4496], [3.3278, 1.3483]] },
    乌鲁木齐: { lat: 43.83, ref: 1.224, m: [[2.0282, 1.2096], [3.0017, 1.5902], [3.7954, 1.9942], [5.9722, 2.5601], [6.0581, 2.9772], [6.7013, 2.7422], [6.3065, 2.8942], [5.3933, 2.1274], [4.9637, 1.6946], [3.371, 1.4294], [2.0352, 1.0255], [1.938, 0.9386]] },
};
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function ratio(lat: number, m: [number, number][], azimuth = 180, useDhi = true) {
    const tilt = empiricalOptimalTilt(lat);
    let g = 0, p = 0;
    m.forEach(([ghi, dhi], i) => {
        g += ghi * DAYS[i];
        p += poaDaily({ lat, month: i + 1, ghi, dhi: useDhi ? dhi : undefined, tilt, azimuth }) * DAYS[i];
    });
    return p / g;
}

describe('POA/GHI 与 pvlib 复算对照（±4%）', () => {
    for (const [city, d] of Object.entries(DATA)) {
        it(city, () => {
            const r = ratio(d.lat, d.m);
            expect(Math.abs(r / d.ref - 1)).toBeLessThan(0.04);
            expect(r).toBeGreaterThan(1); // 中高纬度最佳倾角下倾斜面应高于水平面
        });
    }
    it('无散射数据时 Erbs 分离结果仍在 ±6% 内', () => {
        const d = DATA['北京'];
        expect(Math.abs(ratio(d.lat, d.m, 180, false) / d.ref - 1)).toBeLessThan(0.06);
    });
});

describe('几何与边界', () => {
    it('水平安装 POA = GHI', () => {
        expect(poaDaily({ lat: 39.9, month: 6, ghi: 5, dhi: 2, tilt: 0, azimuth: 180 })).toBeCloseTo(5, 6);
    });
    it('朝北安装低于朝南', () => {
        const s = poaDaily({ lat: 39.9, month: 12, ghi: 2.4, dhi: 0.75, tilt: 30, azimuth: 180 });
        const n = poaDaily({ lat: 39.9, month: 12, ghi: 2.4, dhi: 0.75, tilt: 30, azimuth: 0 });
        expect(n).toBeLessThan(s);
    });
    it('东西对称', () => {
        const e = poaDaily({ lat: 30, month: 3, ghi: 4, dhi: 1.8, tilt: 25, azimuth: 90 });
        const w = poaDaily({ lat: 30, month: 3, ghi: 4, dhi: 1.8, tilt: 25, azimuth: 270 });
        expect(e).toBeCloseTo(w, 6);
    });
    it('赤道春分 H0 ≈ 10.4 kWh/m²/day（Duffie & Beckman 表 1.10.1 量级）', () => {
        expect(monthGeometry(0, 3, 0, 180).H0).toBeGreaterThan(10.0);
        expect(monthGeometry(0, 3, 0, 180).H0).toBeLessThan(10.7);
    });
    it('零辐照返回 0', () => {
        expect(poaDaily({ lat: 39.9, month: 1, ghi: 0, tilt: 30, azimuth: 180 })).toBe(0);
    });
});
