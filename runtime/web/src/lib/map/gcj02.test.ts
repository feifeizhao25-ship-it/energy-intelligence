import { gcj02ToWgs84, outOfChina, wgs84ToGcj02 } from './gcj02';

describe('WGS84 and GCJ-02', () => {
    it('leaves a point outside China unchanged', () => {
        const point = wgs84ToGcj02(40.7128, -74.006);
        expect(point).toEqual({ lat: 40.7128, lng: -74.006 });
        expect(outOfChina(40.7128, -74.006)).toBe(true);
    });

    it('moves a mainland point and round-trips close to the stored coordinate', () => {
        const lat = 39.9087;
        const lng = 116.3975;
        const gcj = wgs84ToGcj02(lat, lng);
        expect(Math.abs(gcj.lat - lat) + Math.abs(gcj.lng - lng)).toBeGreaterThan(0.001);
        const back = gcj02ToWgs84(gcj.lat, gcj.lng);
        expect(Math.abs(back.lat - lat)).toBeLessThan(1e-5);
        expect(Math.abs(back.lng - lng)).toBeLessThan(1e-5);
    });
});
