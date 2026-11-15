/**
 * 张北等远离省会的坐标没有省级风资源样本。测算必须 422 说明缺数据，不能 500，也不能用邻近省会插值编风速。
 */
jest.mock('@/lib/membership/middleware', () => ({
    withMembershipCheck: async (_req: unknown, _opt: unknown, handler: (user: { id: string }) => Promise<Response>) =>
        handler({ id: 'user-1' }),
}));
jest.mock('@/lib/prisma', () => ({
    prisma: { calculation: { create: jest.fn(async () => ({ id: 'calc-1' })) } },
}));
jest.mock('@/lib/security/rate-limit', () => ({
    enforceRateLimit: async () => null,
    PUBLIC_RULES: { calculators: {}, resource: {} },
}));

import { NextRequest } from 'next/server';
import { getWindResource } from './nasa-power';
import { nearestDomesticStation, resolveDomesticStation } from './domestic-station';
import { WindResourceUnavailableError } from './wind-resource-error';
import { POST as memberWind } from '@/app/api/calculator/wind/route';
import { POST as publicWind } from '@/app/api/calculate/wind/route';
import { GET as resourceGet } from '@/app/api/resource/route';

const ZHANGJIANG = { lat: 41.158, lng: 114.714 }; // 张北
const BETWEEN_CAPITALS = { lat: 38.97, lng: 115.46 }; // 两个省会之间，辐照会插值
const BEIJING = { lat: 39.9, lng: 116.41 };

function memberBody(lat: number, lng: number) {
    return {
        lat, lng, province: '江苏',
        turbine: { type: 'medium_wind', capacity: 3, count: 1, hubHeight: 110, rotorDiameter: 160, cutInSpeed: 3, ratedSpeed: 10.5, cutOutSpeed: 25 },
        businessModel: { mode: 'full_export' },
        investment: { unitCost: 6500 },
        operation: {},
    };
}

describe('远离省会的风电测算', () => {
    beforeEach(() => {
        jest.spyOn(global, 'fetch').mockImplementation(async () => {
            throw new Error('风资源请求不得访问外部网络');
        });
    });
    afterEach(() => { jest.restoreAllMocks(); });

    it('张北不在省级样本半径内，插值样本存在但风资源接口拒绝编造', async () => {
        expect(nearestDomesticStation(ZHANGJIANG.lat, ZHANGJIANG.lng)).toBeNull();
        expect(resolveDomesticStation(ZHANGJIANG.lat, ZHANGJIANG.lng)?.city).toBe('插值');
        await expect(getWindResource(ZHANGJIANG.lat, ZHANGJIANG.lng)).rejects.toThrow(WindResourceUnavailableError);
        await expect(getWindResource(ZHANGJIANG.lat, ZHANGJIANG.lng)).rejects.toThrow('该位置暂无风资源数据');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('两个省会之间的坐标同样不拿插值风速去测算', async () => {
        expect(resolveDomesticStation(BETWEEN_CAPITALS.lat, BETWEEN_CAPITALS.lng)?.interpolated).toBe(true);
        await expect(getWindResource(BETWEEN_CAPITALS.lat, BETWEEN_CAPITALS.lng)).rejects.toThrow('该位置暂无风资源数据');
    });

    it('POST /api/calculator/wind 对张北返回 422，响应里没有发电量', async () => {
        const res = await memberWind(new NextRequest('http://x/api/calculator/wind', {
            method: 'POST', body: JSON.stringify(memberBody(ZHANGJIANG.lat, ZHANGJIANG.lng)),
        }));
        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body).toEqual({ error: 'WIND_RESOURCE_UNAVAILABLE', message: '该位置暂无风资源数据' });
        expect(JSON.stringify(body)).not.toMatch(/year1|avgSpeed|generation/);
    });

    it('POST /api/calculate/wind 同样 422，不回 500', async () => {
        const res = await publicWind(new Request('http://x/api/calculate/wind', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ lat: ZHANGJIANG.lat, lng: ZHANGJIANG.lng, capacity: 3000, province: '江苏' }),
        }));
        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.message).toBe('该位置暂无风资源数据');
        expect(body.error).toBe('该位置暂无风资源数据');
        expect(body).not.toHaveProperty('energy');
    });

    it('资源查询 type=wind 对张北是 422', async () => {
        const res = await resourceGet(new NextRequest(`http://x/api/resource?lat=${ZHANGJIANG.lat}&lng=${ZHANGJIANG.lng}&type=wind`));
        expect(res.status).toBe(422);
        expect((await res.json()).message).toBe('该位置暂无风资源数据');
    });

    it('省会坐标仍用样本风速算出结果，不因缺测路径被拒绝', async () => {
        const wind = await getWindResource(BEIJING.lat, BEIJING.lng);
        expect(wind.monthly).toHaveLength(12);
        expect(wind.monthly.every((month) => month.speed50m > 0)).toBe(true);
        const res = await memberWind(new NextRequest('http://x/api/calculator/wind', {
            method: 'POST', body: JSON.stringify(memberBody(BEIJING.lat, BEIJING.lng)),
        }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.energy.year1).toBeGreaterThan(0);
    });
});
