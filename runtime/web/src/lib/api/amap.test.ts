/**
 * Geocode is mocked. These tests must not call restapi.amap.com.
 */
import { gcj02ToWgs84, wgs84ToGcj02 } from '@/lib/map/gcj02';
import { geocodeAddress, reverseGeocode } from './amap';

const KEY = 'unit-test-amap-key';

function jsonResponse(body: unknown) {
    return {
        ok: true,
        status: 200,
        json: async () => body,
    } as Response;
}

describe('高德 Web 服务坐标', () => {
    const originalFetch = global.fetch;
    const originalKey = process.env.AMAP_WEB_SERVICE_KEY;

    beforeEach(() => {
        process.env.AMAP_WEB_SERVICE_KEY = KEY;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        if (originalKey === undefined) delete process.env.AMAP_WEB_SERVICE_KEY;
        else process.env.AMAP_WEB_SERVICE_KEY = originalKey;
    });

    it('把地理编码结果从 GCJ-02 转成库存用的 WGS84，并且不真打高德', async () => {
        const gcj = wgs84ToGcj02(31.2304, 121.4737);
        const raw = `${gcj.lng.toFixed(6)},${gcj.lat.toFixed(6)}`;
        const fetchMock = jest.fn(async () => jsonResponse({
            status: '1',
            geocodes: [{ location: raw, formatted_address: '上海' }],
        }));
        global.fetch = fetchMock as unknown as typeof fetch;

        const rows = await geocodeAddress('上海');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const url = String(fetchMock.mock.calls[0][0]);
        expect(url.startsWith('https://restapi.amap.com/')).toBe(true);
        expect(url).toContain(`key=${KEY}`);
        expect(JSON.stringify(rows)).not.toContain(KEY);
        const [lng, lat] = String(rows[0].location).split(',').map(Number);
        const back = gcj02ToWgs84(gcj.lat, gcj.lng);
        expect(Math.abs(lat - back.lat)).toBeLessThan(1e-5);
        expect(Math.abs(lng - back.lng)).toBeLessThan(1e-5);
        expect(rows[0].location).not.toBe(raw);
    });

    it('逆地理把 WGS84 转成 GCJ-02 再请求', async () => {
        const fetchMock = jest.fn(async () => jsonResponse({
            status: '1',
            regeocode: { formatted_address: '上海', pois: [] },
        }));
        global.fetch = fetchMock as unknown as typeof fetch;
        await reverseGeocode(31.2304, 121.4737);
        const url = new URL(String(fetchMock.mock.calls[0][0]));
        const sent = url.searchParams.get('location');
        const expected = wgs84ToGcj02(31.2304, 121.4737);
        expect(sent).toBe(`${expected.lng.toFixed(6)},${expected.lat.toFixed(6)}`);
        expect(sent).not.toBe('121.473700,31.230400');
    });
});
