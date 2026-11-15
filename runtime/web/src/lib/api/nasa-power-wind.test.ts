/**
 * 风资源：50 米风速必须取 NASA POWER 的 WS50M，而不是把 WS10M 当 50 米风速。
 * 手算：z0 = 0.03 m，v100 = v50 × ln(100/0.03) / ln(50/0.03) = 6 × 8.1117 / 7.4186 = 6.5606 m/s
 */
import { getWindResource, seedWindResourcePayload } from './nasa-power';
import { calculateWind } from '@/lib/calculator/wind';
import { extrapolateWindSpeed } from '@/lib/calculator/wind-shear';

function powerResponse() {
    const months = Array.from({ length: 12 }, (_, i) => `2022${String(i + 1).padStart(2, '0')}`);
    const ws10 = Object.fromEntries([...months.map(m => [m, 4]), ['202213', 4]]);
    const ws50 = Object.fromEntries([...months.map(m => [m, 6]), ['202213', 6]]);
    return { properties: { parameter: { WS10M: ws10, WS50M: ws50 } } };
}

beforeEach(() => {
    seedWindResourcePayload(41.1, 114.9, powerResponse());
    seedWindResourcePayload(41.2, 114.8, powerResponse());
    (global as any).fetch = jest.fn(async () => ({ ok: true, json: async () => powerResponse() }));
});

describe('NASA POWER 风资源', () => {
    it('speed50m 取 WS50M（6 m/s），不是 WS10M（4 m/s）', async () => {
        const r = await getWindResource(41.1, 114.9);
        expect(r.monthly).toHaveLength(12);
        for (const m of r.monthly) {
            expect(m.speed10m).toBe(4);
            expect(m.speed50m).toBe(6);
            expect(m.speed100m).toBeCloseTo(6.5606, 3);
        }
        expect(r.annual.avgSpeed).toBeCloseTo(6.5606, 3);
    });

    it('缺测值 -999 不当作风速', async () => {
        const data = powerResponse();
        (data.properties.parameter.WS50M as any)['202201'] = -999;
        seedWindResourcePayload(10, 10, data);
        const r = await getWindResource(10, 10);
        expect(r.monthly[0].speed50m).toBe(0);
    });

    it('风电测算用的是 WS50M：WS10M 相同、WS50M 更高时发电量更高', async () => {
        const turbine = { type: 'medium_wind' as const, capacity: 2, count: 1, hubHeight: 90, rotorDiameter: 100, cutInSpeed: 3, ratedSpeed: 12, cutOutSpeed: 25 };
        const run = (lat: number) => calculateWind({
            lat, lng: 114.8, province: '河北', projectName: '张家口测试', turbine,
            businessModel: { mode: 'full_export', feedInTariff: 0.35 }, investment: { unitCost: 6000 }, operation: {},
        });
        const high = await run(41.2); // WS50M = 6
        const low = powerResponse();
        for (const k of Object.keys(low.properties.parameter.WS50M)) (low.properties.parameter.WS50M as any)[k] = 4;
        seedWindResourcePayload(41.3, 114.8, low);
        const same = await run(41.3); // WS50M = WS10M = 4，相当于旧的错误口径
        expect(high.energy.year1).toBeGreaterThan(same.energy.year1 * 1.2);
        expect(extrapolateWindSpeed(6, 50, 50)).toBeCloseTo(6, 10);
    });
});
