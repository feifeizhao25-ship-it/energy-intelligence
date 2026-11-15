/**
 * 瓦片 502：高德上游在本环境返回 200 图片。天地图无密钥时返回 418，由本路由报 502。
 * 同一服务商某台主机 502 时换一台再取；不是图片的响应不当成瓦片。
 */
import { NextRequest } from 'next/server';
import { GET } from './route';

const PNG = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...Array.from({ length: 40 }, () => 1),
]);

function tileResponse(body: Uint8Array | string, status: number, contentType: string) {
    const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    } as Response;
}

describe('GET /api/map-tiles/tile', () => {
    const previous = {
        APP_EDITION: process.env.APP_EDITION,
        MAP_TILE_PROVIDER: process.env.MAP_TILE_PROVIDER,
        GAODE_MAP_KEY: process.env.GAODE_MAP_KEY,
        TIANDITU_KEY: process.env.TIANDITU_KEY,
    };

    beforeEach(() => {
        process.env.APP_EDITION = 'cn';
        process.env.MAP_TILE_PROVIDER = 'gaode';
        process.env.GAODE_MAP_KEY = 'server-only';
        delete process.env.TIANDITU_KEY;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    function getTile() {
        return GET(new NextRequest('http://x/api/map-tiles/tile?z=4&x=12&y=6'));
    }

    it('一台高德主机 502 时改问下一台，浏览器拿到图片', async () => {
        const fetchImpl = jest.fn()
            .mockResolvedValueOnce(tileResponse('bad gateway', 502, 'text/html'))
            .mockResolvedValueOnce(tileResponse(PNG, 200, 'image/png'));
        global.fetch = fetchImpl as unknown as typeof fetch;
        const res = await getTile();
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('image/png');
        const hosts = fetchImpl.mock.calls.map((call) => String(call[0]));
        expect(hosts[0]).toContain('webrd0');
        expect(hosts[1]).toContain('webrd0');
        expect(hosts[0]).not.toBe(hosts[1]);
        expect(hosts.join('')).not.toContain('server-only');
    });

    it('两台都失败时返回 502 和中文说明', async () => {
        global.fetch = jest.fn(async () => tileResponse('down', 502, 'text/html')) as unknown as typeof fetch;
        const res = await getTile();
        expect(res.status).toBe(502);
        expect(await res.json()).toEqual({ error: '地图瓦片暂时不可用' });
    });

    it('200 的网页不当成瓦片；天地图 418 是上游拒绝，不换供应商', async () => {
        global.fetch = jest.fn(async () => tileResponse('<html>denied</html>', 200, 'text/html')) as unknown as typeof fetch;
        const html = await getTile();
        expect(html.status).toBe(502);

        process.env.MAP_TILE_PROVIDER = 'tianditu';
        process.env.TIANDITU_KEY = 'server-token';
        const fetchImpl = jest.fn(async () => tileResponse('teapot', 418, 'text/html'));
        global.fetch = fetchImpl as unknown as typeof fetch;
        const rejected = await getTile();
        expect(rejected.status).toBe(502);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(String(fetchImpl.mock.calls[0][0])).toContain('tianditu.gov.cn');
        expect(JSON.stringify(await rejected.json())).not.toContain('server-token');
    });
});
