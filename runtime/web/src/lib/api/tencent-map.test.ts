/**
 * 腾讯位置服务提供方。fetch 全部 mock，不真打 apis.map.qq.com。
 */
import { createHash } from 'crypto';
import { gcj02ToWgs84, wgs84ToGcj02 } from '@/lib/map/gcj02';
import { geocodeAddress, reverseGeocode, searchNearbyPOIs, getLocationSuggestions, tencentSignature, tencentUrl } from './tencent-map';
import { locationProvider, geocodeAddress as providerGeocode, isLocationProviderError } from './location-provider';

const KEY = 'UNIT-TEST-TENCENT-KEY';
const SK = 'unit-test-sk';

function jsonResponse(body: unknown) {
    return { ok: true, status: 200, json: async () => body } as Response;
}

describe('腾讯位置服务 WebService', () => {
    const originalFetch = global.fetch;
    const saved = { key: process.env.TENCENT_MAP_KEY, sk: process.env.TENCENT_MAP_SK, provider: process.env.LOCATION_PROVIDER };

    beforeEach(() => {
        process.env.TENCENT_MAP_KEY = KEY;
        delete process.env.TENCENT_MAP_SK;
    });
    afterEach(() => {
        global.fetch = originalFetch;
        for (const [name, value] of [['TENCENT_MAP_KEY', saved.key], ['TENCENT_MAP_SK', saved.sk], ['LOCATION_PROVIDER', saved.provider]] as const) {
            if (value === undefined) delete process.env[name]; else process.env[name] = value;
        }
    });

    it('签名按文档：路径?按参数名升序的原始参数+SK 的 md5（小写）', () => {
        const params = { location: '28.7033487,115.8660847', key: 'K' };
        const expected = createHash('md5').update('/ws/geocoder/v1?key=K&location=28.7033487,115.8660847' + SK).digest('hex');
        expect(tencentSignature('/ws/geocoder/v1', params, SK)).toBe(expected);
        expect(expected).toMatch(/^[0-9a-f]{32}$/);
    });

    it('签名用未编码的中文原值，发送时逐个参数编码并附 sig', () => {
        const url = new URL(tencentUrl('/ws/place/v1/search', { boundary: 'region(北京)', keyword: '美食' }, 'K', SK));
        expect(url.searchParams.get('keyword')).toBe('美食');
        expect(url.search).toContain(`keyword=${encodeURIComponent('美食')}`);
        const raw = createHash('md5').update('/ws/place/v1/search?boundary=region(北京)&key=K&keyword=美食' + SK).digest('hex');
        expect(url.searchParams.get('sig')).toBe(raw);
    });

    it('没配 SK 时不带 sig', () => {
        expect(new URL(tencentUrl('/ws/geocoder/v1', { address: '北京' }, 'K', '')).searchParams.get('sig')).toBeNull();
    });

    it('地理编码：GCJ-02 转 WGS84，字段整理成和高德一样，结果里没有 Key', async () => {
        process.env.TENCENT_MAP_SK = SK;
        const gcj = wgs84ToGcj02(39.9042, 116.4074);
        const fetchMock = jest.fn(async () => jsonResponse({
            status: 0,
            result: { title: '北京市', location: { lat: gcj.lat, lng: gcj.lng }, ad_info: { adcode: '110101' },
                address_components: { province: '北京市', city: '北京市', district: '东城区', street: '', street_number: '' }, level: 4 },
        }));
        global.fetch = fetchMock as unknown as typeof fetch;
        const rows = await geocodeAddress('北京市东城区');
        const url = new URL(String(fetchMock.mock.calls[0][0]));
        expect(url.origin + url.pathname).toBe('https://apis.map.qq.com/ws/geocoder/v1');
        expect(url.searchParams.get('key')).toBe(KEY);
        expect(url.searchParams.get('sig')).toMatch(/^[0-9a-f]{32}$/);
        expect(rows[0].formatted_address).toBe('北京市东城区');
        expect(rows[0].province).toBe('北京市');
        const [lng, lat] = String(rows[0].location).split(',').map(Number);
        const back = gcj02ToWgs84(gcj.lat, gcj.lng);
        expect(Math.abs(lat - back.lat)).toBeLessThan(1e-5);
        expect(Math.abs(lng - back.lng)).toBeLessThan(1e-5);
        expect(JSON.stringify(rows)).not.toContain(KEY);
        expect(JSON.stringify(rows)).not.toContain(SK);
    });

    it('逆地理：WGS84 转 GCJ-02 后按「纬度,经度」请求，返回 addressComponent 和 POI', async () => {
        const fetchMock = jest.fn(async () => jsonResponse({
            status: 0,
            result: { address: '北京市东城区东长安街', address_component: { province: '北京市', city: '北京市', district: '东城区' }, ad_info: { adcode: '110101' },
                pois: [{ title: '天安门', address: '东长安街', location: { lat: 39.90872, lng: 116.39748 }, _distance: 12, category: '旅游景点' }] },
        }));
        global.fetch = fetchMock as unknown as typeof fetch;
        const out = await reverseGeocode(39.9042, 116.4074);
        const sent = new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('location');
        const gcj = wgs84ToGcj02(39.9042, 116.4074);
        expect(sent).toBe(`${gcj.lat.toFixed(6)},${gcj.lng.toFixed(6)}`);
        expect(out?.formatted_address).toBe('北京市东城区东长安街');
        expect(out?.addressComponent.province).toBe('北京市');
        expect(out?.pois[0].name).toBe('天安门');
        expect(out?.pois[0].distance).toBe(12);
    });

    it('周边搜索一次一个关键词，最多 3 个；输入提示整理出 name/district', async () => {
        const fetchMock = jest.fn(async () => jsonResponse({ status: 0, data: [{ title: '变电站', address: 'x', location: { lat: 39.9, lng: 116.4 }, _distance: 100 }] }));
        global.fetch = fetchMock as unknown as typeof fetch;
        const rows = await searchNearbyPOIs(39.9, 116.4, ['变电站', '光伏', '风电', '储能'], 3000);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('boundary')).toMatch(/^nearby\([\d.]+,[\d.]+,3000,0\)$/);
        expect(rows).toHaveLength(3);
        fetchMock.mockImplementation(async () => jsonResponse({ status: 0, data: [{ title: '国家电网', province: '北京市', city: '北京市', district: '西城区', location: { lat: 39.9, lng: 116.36 } }] }));
        const tips = await getLocationSuggestions('国家电网');
        expect(tips[0]).toMatchObject({ name: '国家电网', district: '北京市西城区' });
    });

    it('上游 112（IP 未授权）回 503，不透出上游 message 里的 IP；347 回 404', async () => {
        global.fetch = jest.fn(async () => jsonResponse({ status: 112, message: 'IP未被授权（本次请求来源IP为：2001:db8::1）' })) as unknown as typeof fetch;
        await expect(geocodeAddress('北京')).rejects.toMatchObject({ code: 'upstream', httpStatus: 503, upstreamStatus: 112 });
        await geocodeAddress('北京').catch((error) => {
            expect(String(error.message)).not.toContain('2001:db8');
            expect(isLocationProviderError(error)).toBe(true);
        });
        global.fetch = jest.fn(async () => jsonResponse({ status: 347, message: '查询无结果' })) as unknown as typeof fetch;
        await expect(geocodeAddress('火星基地')).rejects.toMatchObject({ code: 'not_found', httpStatus: 404 });
        global.fetch = jest.fn(async () => jsonResponse({ status: 348, message: '参数错误' })) as unknown as typeof fetch;
        await expect(geocodeAddress('火星乌托邦平原基地xyz')).rejects.toMatchObject({ code: 'not_found', httpStatus: 404, upstreamStatus: 348 });
        global.fetch = jest.fn(async () => jsonResponse({ status: 121, message: '此key每日调用量已达到上限' })) as unknown as typeof fetch;
        await expect(searchNearbyPOIs(39.7, 98.5, ['变电站'])).rejects.toMatchObject({ code: 'quota', httpStatus: 503, upstreamStatus: 121 });
    });

    it('没配 Key 就不请求', async () => {
        delete process.env.TENCENT_MAP_KEY;
        const fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        await expect(geocodeAddress('北京')).rejects.toMatchObject({ code: 'key_missing', httpStatus: 503 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('开关：默认腾讯；LOCATION_PROVIDER=amap / 高德 时切回高德', async () => {
        expect(locationProvider({} as NodeJS.ProcessEnv)).toBe('tencent');
        expect(locationProvider({ LOCATION_PROVIDER: 'amap' } as unknown as NodeJS.ProcessEnv)).toBe('amap');
        expect(locationProvider({ LOCATION_PROVIDER: '高德' } as unknown as NodeJS.ProcessEnv)).toBe('amap');
        expect(locationProvider({ LOCATION_PROVIDER: 'tencent' } as unknown as NodeJS.ProcessEnv)).toBe('tencent');
        process.env.LOCATION_PROVIDER = 'tencent';
        const fetchMock = jest.fn(async () => jsonResponse({ status: 0, result: { location: { lat: 39.9, lng: 116.4 }, address_components: { province: '北京市' } } }));
        global.fetch = fetchMock as unknown as typeof fetch;
        await providerGeocode('北京');
        expect(String(fetchMock.mock.calls[0][0]).startsWith('https://apis.map.qq.com/')).toBe(true);
    });
});
