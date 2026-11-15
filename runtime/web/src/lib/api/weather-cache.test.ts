const refuseOverseas = jest.fn(async (url: string) => {
    const json = async () => {
        if (url.includes('/air_pollution')) {
            return {
                list: [{
                    main: { aqi: 2 },
                    components: { co: 1, no2: 2, o3: 3, so2: 4, pm2_5: 5, pm10: 6, nh3: 7 },
                }],
            };
        }
        if (url.includes('/uvi')) return { value: 5.5, time_iso: '2026-11-11T00:00:00Z' };
        return {
            main: { temp: 21.2, humidity: 40, pressure: 1010 },
            wind: { speed: 3, deg: 90 },
            clouds: { all: 10 },
            weather: [{ description: '晴', icon: '01d' }],
            visibility: 10000,
        };
    };
    return { ok: true, status: 200, json } as Response;
});

jest.mock('@/lib/data/overseas-gate', () => ({ refuseOverseas: (...args: unknown[]) => refuseOverseas(...args) }));

import { getAirQuality, getCurrentWeather, getUVIndex } from './weather';

describe('天气缓存按数据类型分开', () => {
    beforeAll(() => {
        process.env.OPENWEATHERMAP_API_KEY = 'test-only';
    });

    it('同一经纬度的空气质量和紫外线不会返回天气结果', async () => {
        const weather = await getCurrentWeather(31.23, 121.47);
        const air = await getAirQuality(31.23, 121.47);
        const uv = await getUVIndex(31.23, 121.47);
        expect(weather.temp).toBe(21.2);
        expect(air.aqi).toBe(2);
        expect(air).not.toHaveProperty('temp');
        expect(uv.value).toBe(5.5);
        expect(uv).not.toHaveProperty('temp');
        const urls = refuseOverseas.mock.calls.map((call) => String(call[0]));
        expect(urls.filter((url) => url.includes('/weather?'))).toHaveLength(1);
        expect(urls.filter((url) => url.includes('/air_pollution'))).toHaveLength(1);
        expect(urls.filter((url) => url.includes('/uvi'))).toHaveLength(1);
        await getCurrentWeather(31.23, 121.47);
        expect(refuseOverseas.mock.calls.filter((call) => String(call[0]).includes('/weather?'))).toHaveLength(1);
    });
});
