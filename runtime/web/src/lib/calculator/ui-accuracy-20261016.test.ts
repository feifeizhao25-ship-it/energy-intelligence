import { proportionalRange } from './ranges';


describe('UI 实测问题回归（2026-10-16）', () => {
    it('中值为负时区间仍满足 low ≤ median ≤ high', () => {
        const r = proportionalRange(-44550, 0.1);
        expect(r.low).toBeLessThanOrEqual(r.median);
        expect(r.high).toBeGreaterThanOrEqual(r.median);
    });
});
