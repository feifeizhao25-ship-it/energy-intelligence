/**
 * 张北（河北）经搜索或地图点选后，纬度、经度、地名、省份要进入测算请求。
 * #146 只保住了省份；坐标若仍是页面默认的北京，测算不会走到「该位置暂无风资源数据」。
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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { resolveMapSearch } from '@/lib/map/map-search';
import { applyWindPick } from '@/lib/map/wind-place';
import { windRequestBody, type WindDraft } from '@/lib/calculator/wind-request';
import { POST as memberWind } from '@/app/api/calculator/wind/route';

const ZHANGJIANG = { lat: 41.158, lng: 114.714 };

const BEIJING: WindDraft = {
    lat: 39.9042,
    lng: 116.4074,
    name: '',
    province: '北京',
    turbineType: 'medium_wind',
    capacity: 3,
    count: 1,
    hubHeight: 110,
    rotorDiameter: 160,
    businessMode: 'full_export',
    cooperationMode: 'rental',
    unitCost: 6500,
};

function jsonResponse(body: unknown): Response {
    return { ok: true, status: 200, json: async () => body } as Response;
}

describe('风电选点张北', () => {
    beforeEach(() => {
        jest.spyOn(global, 'fetch').mockImplementation(async () => {
            throw new Error('风资源请求不得访问外部网络');
        });
    });
    afterEach(() => { jest.restoreAllMocks(); });

    it('搜索张北后，经纬度、地名、省份进入测算，并得到 422', async () => {
        const fetchImpl = jest.fn(async () => jsonResponse({
            data: [{
                location: '114.714000,41.158000',
                formatted_address: '河北省张家口市张北县',
                province: '河北省',
            }],
        }));
        const hit = await resolveMapSearch('张北', fetchImpl as unknown as typeof fetch);
        if ('error' in hit) throw new Error(hit.error);
        expect(hit.province).toBe('河北');
        expect(hit.name).toContain('张北');

        const form = applyWindPick(BEIJING, {
            lat: hit.lat,
            lng: hit.lng,
            address: hit.name,
            province: hit.province,
        });
        expect(form.lat).toBe(ZHANGJIANG.lat);
        expect(form.lng).toBe(ZHANGJIANG.lng);
        expect(form.name).toBe('河北省张家口市张北县');
        expect(form.province).toBe('河北');
        expect(form.lat).not.toBe(BEIJING.lat);
        expect(form.lng).not.toBe(BEIJING.lng);

        // 河北电价表没有燃煤基准价，须带上用户填写的上网电价，测算才会走到风资源校验。
        const body = windRequestBody(form, '0.5');
        expect(body.lat).toBe(ZHANGJIANG.lat);
        expect(body.lng).toBe(ZHANGJIANG.lng);
        expect(body.name).toBe('河北省张家口市张北县');
        expect(body.province).toBe('河北');
        expect(body.businessModel.feedInTariff).toBe(0.5);

        const res = await memberWind(new NextRequest('http://x/api/calculator/wind', {
            method: 'POST',
            body: JSON.stringify(body),
        }));
        expect(res.status).toBe(422);
        expect(await res.json()).toEqual({ error: 'WIND_RESOURCE_UNAVAILABLE', message: '该位置暂无风资源数据' });

        const page = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
        const picker = readFileSync(join(__dirname, '../../../../components/map/LocationPicker.tsx'), 'utf8');
        expect(page).toContain('applyWindPick');
        expect(page).toContain('windRequestBody');
        const searchFn = picker.slice(picker.indexOf('const handleSearch'), picker.indexOf('const handleLocateMe'));
        expect(searchFn).toContain('address: result.name');
        expect(searchFn).toContain('province: result.province');
        expect(searchFn).toContain('stage(');
        expect(searchFn).not.toContain('onChange(');
        expect(picker).toContain("onPick={(location) => stage({ lat: location.lat, lng: location.lng, address: '' })}");
        const confirmFn = picker.slice(picker.indexOf('const handleConfirm'), picker.indexOf('const handleCancel'));
        expect(confirmFn).toContain('onChange(result.applied)');
        expect(picker).toContain('z-[70]');
    });

    it('地图点选只有坐标时也替换默认经纬度，省份按 #146 保留', async () => {
        const form = applyWindPick(BEIJING, { lat: ZHANGJIANG.lat, lng: ZHANGJIANG.lng, address: '' });
        expect(form.lat).toBe(ZHANGJIANG.lat);
        expect(form.lng).toBe(ZHANGJIANG.lng);
        expect(form.province).toBe('北京');
        expect(form.name).toBe('');
        const res = await memberWind(new NextRequest('http://x/api/calculator/wind', {
            method: 'POST',
            body: JSON.stringify(windRequestBody(form, '')),
        }));
        expect(res.status).toBe(422);
        expect((await res.json()).message).toBe('该位置暂无风资源数据');
    });
});
