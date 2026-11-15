import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAP_SEARCH_MISS, resolveMapSearch, windPickerSearchNote } from './map-search';

function jsonResponse(body: unknown, ok = true): Response {
    return { ok, status: ok ? 200 : 404, json: async () => body } as Response;
}

describe('地图搜索', () => {
    it('接受「纬度,经度」，不请求地理编码', async () => {
        const fetchImpl = jest.fn();
        const hit = await resolveMapSearch('31.23, 121.47', fetchImpl as unknown as typeof fetch);
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(hit).toEqual({ lat: 31.23, lng: 121.47, name: '31.23, 121.47' });
    });

    it('地名走 /api/location 地理编码，并把地图中心设为返回坐标', async () => {
        const fetchImpl = jest.fn(async () => jsonResponse({
            data: [{ location: '121.473700,31.230400', formatted_address: '上海市' }],
        }));
        const hit = await resolveMapSearch('上海', fetchImpl as unknown as typeof fetch);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(String(fetchImpl.mock.calls[0][0])).toBe('/api/location?action=geocode&address=%E4%B8%8A%E6%B5%B7');
        expect(hit).toEqual({ lat: 31.2304, lng: 121.4737, name: '上海市', province: '上海' });
    });

    it('没有结果时给出中文说明', async () => {
        const fetchImpl = jest.fn(async () => jsonResponse({ data: [] }));
        const hit = await resolveMapSearch('不存在的地点', fetchImpl as unknown as typeof fetch);
        expect(hit).toEqual({ error: MAP_SEARCH_MISS, code: 'not_found' });
        expect(MAP_SEARCH_MISS).toMatch(/未找到该地点/);
    });

    it('404 not_found 仍是未找到，503 key_missing 让风电选点显示未配置密钥', async () => {
        const missing = await resolveMapSearch('无名地', jest.fn(async () => jsonResponse({ code: 'not_found', error: '未找到该地点' }, false)) as unknown as typeof fetch);
        expect(missing).toEqual({ error: MAP_SEARCH_MISS, code: 'not_found' });
        const noKey = await resolveMapSearch('上海', jest.fn(async () => ({
            ok: false,
            status: 503,
            json: async () => ({ code: 'key_missing', error: '位置服务未配置' }),
        } as Response)) as unknown as typeof fetch);
        expect(noKey).toEqual({ error: '地图未配置密钥，请直接填写经纬度', code: 'key_missing' });
        expect(windPickerSearchNote(noKey as { error: string; code: 'key_missing' })).toBe('地图服务暂不可用，地图未配置密钥，请直接填写经纬度');
        const picker = readFileSync(join(__dirname, '../../components/map/LocationPicker.tsx'), 'utf8');
        expect(picker).toContain('windPickerSearchNote');
        expect(picker).toContain('地图未配置密钥，请直接填写经纬度');
    });

    it('/map 的搜索框接到这个解析，并把结果交给地图中心', () => {
        const page = readFileSync(join(__dirname, '../../components/map/ResourceMapPage.tsx'), 'utf8');
        expect(page).toContain('搜索地点或经纬度');
        expect(page).toContain('resolveMapSearch');
        expect(page).toContain('focus={mapCenter}');
        expect(page).toContain('role="alert"');
        expect(page).toContain('MAP_SEARCH_MISS');
        expect(page).toContain('flex-col');
        expect(page).toContain('max-w-full');
        expect(page).toContain('whitespace-normal break-words');
        expect(page).not.toContain('shadow-2xl w-56 space-y-3');
    });
});
