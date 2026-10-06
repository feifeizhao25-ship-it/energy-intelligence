/**
 * /api/calculate/solar 的电价：读统一电价表，返回「数据截至」；
 * 已取消固定分时的省份必须输入合同电价；查不到的省份不按其他省份兜底。
 */
jest.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: async () => null, PUBLIC_RULES: { calculators: {} } }));
const calculateSolar = jest.fn(async (input: unknown) => ({ input }));
jest.mock('@/lib/calculator/solar', () => ({
    ...jest.requireActual('@/lib/calculator/solar'),
    calculateSolar: (input: unknown) => calculateSolar(input),
}));

import { POST } from './route';

const post = (body: Record<string, unknown>) => POST(new Request('http://localhost/api/calculate/solar', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: 32, lng: 118.8, capacity: 100, ...body }),
}));

describe('/api/calculate/solar 电价', () => {
    beforeEach(() => calculateSolar.mockClear());

    it('江苏：取统一电价表，返回「电价数据截至 2025-12」与超期提示', async () => {
        const res = await post({ province: '江苏', selfUseRatio: 70, electricityPrice: 0.85, feedInTariff: 0.65 });
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.pricing.asOfLabel).toBe('电价数据截至 2025-12');
        expect(json.pricing.source).toContain('来源待核实');
        const input = calculateSolar.mock.calls[0][0] as any;
        // 手算自用电价 (1.08×4 + 0.64×8 + 0.31×12) ÷ 24 = 0.5483；上网电价取表内 0.391；前端占位值被忽略
        expect(input.electricityPrice).toBeCloseTo(0.5483, 4);
        expect(input.feedInTariff).toBe(0.391);
        expect(input.selfUseRatio).toBeCloseTo(0.7, 10);
    });

    it('河北（已取消固定分时）：没有合同电价时 422，提示输入合同电价', async () => {
        const res = await post({ province: '河北' });
        const json = await res.json();
        expect(res.status).toBe(422);
        expect(json.code).toBe('MARKET_TOU');
        expect(json.error).toContain('已取消固定分时，按市场化交易价格测算，请输入合同电价');
        expect(calculateSolar).not.toHaveBeenCalled();
    });

    it('河北：输入合同电价后按合同电价测算', async () => {
        const res = await post({ province: '河北', contractPrice: 0.52 });
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.pricing.asOfLabel).toBe('电价为用户输入的合同电价');
        expect((calculateSolar.mock.calls[0][0] as any).electricityPrice).toBe(0.52);
    });

    it('查不到的省份：422「暂无该省数据」，不按北京兜底', async () => {
        const res = await post({ province: '西藏' });
        const json = await res.json();
        expect(res.status).toBe(422);
        expect(json.error).toContain('暂无该省数据');
        expect(calculateSolar).not.toHaveBeenCalled();
    });
});
