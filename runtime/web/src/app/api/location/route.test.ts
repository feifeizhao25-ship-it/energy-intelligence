/**
 * 地理编码失败分类。fetch 全部是替身，不访问高德。
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/security/rate-limit', () => ({
    enforceRateLimit: async () => null,
    PUBLIC_RULES: { amap: { name: 'amap', anonymous: 30, authenticated: 90, windowMs: 60_000 } },
}));

import { GET } from './route';

function amapFetch(body: unknown, status = 200) {
    return jest.fn(async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as Response));
}

describe('GET /api/location', () => {
    const originalFetch = global.fetch;
    const originalKey = process.env.AMAP_WEB_SERVICE_KEY;

    afterEach(() => {
        global.fetch = originalFetch;
        if (originalKey === undefined) delete process.env.AMAP_WEB_SERVICE_KEY;
        else process.env.AMAP_WEB_SERVICE_KEY = originalKey;
    });

    function geocode(address = '查无此地') {
        return GET(new NextRequest(`http://x/api/location?action=geocode&address=${encodeURIComponent(address)}`));
    }

    it('高德没有结果时返回 404 not_found', async () => {
        process.env.AMAP_WEB_SERVICE_KEY = 'unit-test-key';
        global.fetch = amapFetch({ status: '1', geocodes: [] }) as unknown as typeof fetch;
        const res = await geocode();
        expect(res.status).toBe(404);
        expect(await res.json()).toMatchObject({ code: 'not_found' });
    });

    it('ENGINE_RESPONSE_DATA_ERROR 返回 404，而不是 500', async () => {
        process.env.AMAP_WEB_SERVICE_KEY = 'unit-test-key';
        global.fetch = amapFetch({ status: '0', info: 'ENGINE_RESPONSE_DATA_ERROR' }) as unknown as typeof fetch;
        const res = await geocode('###');
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.code).toBe('not_found');
        expect(body.error).toBe('未找到该地点');
    });

    it('没有配置密钥时返回 503 key_missing，并且不请求高德', async () => {
        delete process.env.AMAP_WEB_SERVICE_KEY;
        const fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        const res = await geocode('上海');
        expect(res.status).toBe(503);
        expect(await res.json()).toMatchObject({ code: 'key_missing' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('上游 HTTP 失败返回 503，其它异常返回 500', async () => {
        process.env.AMAP_WEB_SERVICE_KEY = 'unit-test-key';
        global.fetch = amapFetch({ info: 'bad gateway' }, 502) as unknown as typeof fetch;
        const upstream = await geocode('上海');
        expect(upstream.status).toBe(503);
        expect(await upstream.json()).toMatchObject({ code: 'upstream' });

        global.fetch = jest.fn(async () => { throw new Error('socket hang up'); }) as unknown as typeof fetch;
        const broken = await geocode('上海');
        expect(broken.status).toBe(500);
        expect(await broken.json()).toMatchObject({ code: 'upstream' });
    });
});
