/**
 * 首页快速估算：不再是第三套光伏口径（峰值小时 × 0.82、电价 0.6、未匹配城市按「中国平均」编结果）。
 * 同一城市坐标下，结果与完整测算 calculateSolar（屋顶、标准组件、全部自用）完全一致。
 */
jest.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: async () => null, PUBLIC_RULES: { calculators: {} } }));
jest.mock('@/lib/services/policy-service', () => ({ PolicyService: { getActivePolicies: jest.fn(async () => []) } }));

import { NextRequest } from 'next/server';
import { POST } from './route';
import { calculateSolar } from '@/lib/calculator/solar';
import { lookupTariff } from '@/lib/pricing/tariffs';

const YEAR = new Date().getUTCFullYear() - 1;
function nasa(lat: number, lng: number) {
    const months = (v: number) => Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(YEAR) + String(i + 1).padStart(2, '0'), v]));
    return { geometry: { coordinates: [lng, lat] }, parameters: { ALLSKY_SFC_SW_DWN: { units: 'kW-hr/m^2/day' }, T2M: { units: 'C' } },
        header: { fill_value: -999, start: `${YEAR}0101`, end: `${YEAR}1231`, time_standard: 'UTC' },
        properties: { parameter: { ALLSKY_SFC_SW_DWN: months(3.9), T2M: months(16) } } };
}
beforeEach(() => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
        const u = new URL(String(url));
        return new Response(JSON.stringify(nasa(Number(u.searchParams.get('latitude')), Number(u.searchParams.get('longitude')))));
    });
});
afterEach(() => jest.restoreAllMocks());

const post = (body: object) => POST(new NextRequest('http://x/api/calculator/quick', { method: 'POST', body: JSON.stringify(body) }));

describe('首页快速估算', () => {
    it('南京 100 kW：发电量、收益、IRR 与完整测算同一结果，电价取江苏工商业平均电价并标注来源状态', async () => {
        const res = await post({ location: '江苏南京', capacity: 100 });
        expect(res.status).toBe(200);
        const { data } = await res.json();
        const price = (lookupTariff('江苏') as any).retailPrice;
        const full = await calculateSolar({ lat: 32.0603, lng: 118.7969, capacity: 100, installationType: 'roof', moduleType: 'standard',
            selfUseRatio: 1, electricityPrice: price, feedInTariff: price, unitCost: 3000, province: '江苏' });
        expect(data.energy.annualGeneration).toBe(Math.round(full.energy.year1));
        expect(data.financial.annualRevenue).toBe(Math.round(full.financial.year1Revenue));
        expect(data.financial.irr).toBeCloseTo(Math.round(full.financial.irr * 10) / 10, 10);
        expect(data.pricing.label).toContain('来源待核实');
        expect(data.assumptions).toContain('3000 元/kW');
    });

    it('未收录电价/已取消固定分时的省份（石家庄）：只给发电量，不编收益', async () => {
        const { data } = await (await post({ location: '石家庄', capacity: 50 })).json();
        expect(data.energy.annualGeneration).toBeGreaterThan(0);
        expect(data.financial.annualRevenue).toBeNull();
        expect(data.financial.irr).toBeNull();
        expect(data.pricing.label).toContain('已取消固定分时');
    });

    it('没匹配到城市：422 中文提示，不再按「中国平均」编结果', async () => {
        const res = await post({ location: '某某县', capacity: 50 });
        expect(res.status).toBe(422);
        expect((await res.json()).message).toContain('暂只支持');
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
