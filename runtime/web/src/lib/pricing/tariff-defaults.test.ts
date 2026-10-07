/**
 * 风电、储能测算的电价：不再写死（储能峰 1.0 / 谷 0.3 / 平 0.6，风电上网 0.4、自用 0.6），
 * 默认读省级电价表并带出「来源待核实」状态，用户填写的优先；查不到的省份必须由用户填写，不编数字。
 */
jest.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit: async () => null, PUBLIC_RULES: { calculators: {} } }));
const calculateStorage = jest.fn(async (input: any) => ({ input }));
const calculateWind = jest.fn(async (input: any) => ({ input }));
jest.mock('@/lib/calculator/storage', () => ({ calculateStorage: (input: any) => calculateStorage(input) }));
jest.mock('@/lib/calculator/wind', () => ({ calculateWind: (input: any) => calculateWind(input) }));

import { tariffDefaults, resolveStoragePrices, resolveWindPrices, PriceInputError } from './tariff-defaults';
import { TARIFFS, NEW_ENERGY_FEED_IN_BASIS } from './tariffs';
import { POST as storagePost } from '@/app/api/calculate/storage/route';
import { POST as windPost } from '@/app/api/calculate/wind/route';

const NOW = new Date('2026-10-07T00:00:00Z');

describe('电价表：上网电价改称燃煤发电基准价，并说明 136 号文后的市场化', () => {
    it('表里不再有「上网电价」字段，原数值改为 coalBenchmarkPrice（来源待核实）', () => {
        for (const t of Object.values(TARIFFS)) {
            expect('feedInTariff' in t).toBe(false);
            if (t.coalBenchmarkPrice !== undefined) {
                expect(t.sourceVerified).toBe(false);
                expect(t.note).toContain('燃煤发电基准价');
            }
        }
        expect(NEW_ENERGY_FEED_IN_BASIS).toContain('发改价格〔2025〕136 号');
        expect(NEW_ENERGY_FEED_IN_BASIS).toContain('机制电价');
    });

    it('tariffDefaults：江苏带出分时价、燃煤发电基准价与「来源待核实」、数据截至', () => {
        const d = tariffDefaults('江苏省', NOW);
        expect(d).toMatchObject({ status: 'ok', province: '江苏', peak: 1.08, flat: 0.64, valley: 0.31, coalBenchmarkPrice: 0.391, sourceStatus: '来源待核实', asOfLabel: '电价数据截至 2025-12', stale: true });
        expect(tariffDefaults('河北', NOW)).toMatchObject({ status: 'market', peak: null, coalBenchmarkPrice: null });
        expect(tariffDefaults('新疆', NOW).status).toBe('missing');
    });
});

describe('储能电价', () => {
    it('没填就按电价表（江苏峰 1.08 / 谷 0.31），并标「来源待核实」', () => {
        const r = resolveStoragePrices('江苏', {}, { now: NOW });
        expect(r.peakPrice).toBe(1.08);
        expect(r.valleyPrice).toBe(0.31);
        expect(r.pricing).toMatchObject({ province: '江苏', sourceStatus: '来源待核实', userProvided: [] });
    });

    it('用户填写的优先，并记录哪些是用户填的', () => {
        const r = resolveStoragePrices('江苏', { peakPrice: '1.2' }, { now: NOW });
        expect(r.peakPrice).toBe(1.2);
        expect(r.valleyPrice).toBe(0.31);
        expect(r.pricing.userProvided).toEqual(['peakPrice']);
    });

    it('已取消固定分时（河北）或未收录（新疆）的省份：不填就报错，填全了就按用户输入', () => {
        expect(() => resolveStoragePrices('河北', {}, { now: NOW })).toThrow(PriceInputError);
        expect(() => resolveStoragePrices('新疆', { peakPrice: 1 }, { now: NOW })).toThrow('请填写峰、谷电价');
        const r = resolveStoragePrices('河北', { peakPrice: 0.9, valleyPrice: 0.28 }, { now: NOW });
        expect(r.pricing.sourceStatus).toBe('用户输入');
    });

    it('两充两放才需要平段价；山东电价表没有平段价时不按峰谷均值编造', () => {
        expect(() => resolveStoragePrices('山东', {}, { needsFlat: true, now: NOW })).toThrow('平时电价');
        expect(resolveStoragePrices('山东', {}, { now: NOW }).flatPrice).toBeUndefined();
    });

    it('填了非法数值直接报错，不静默改成默认值', () => {
        expect(() => resolveStoragePrices('江苏', { peakPrice: 'abc' }, { now: NOW })).toThrow('峰时电价');
        expect(() => resolveStoragePrices('江苏', { valleyPrice: -1 }, { now: NOW })).toThrow('谷时电价');
    });
});

describe('风电电价', () => {
    it('全额上网：默认取燃煤发电基准价作参考，并附 136 号文说明', () => {
        const r = resolveWindPrices('江苏', {}, 'full_export', NOW);
        expect(r.feedInTariff).toBe(0.391);
        expect(r.electricityPrice).toBeUndefined();
        expect(r.pricing.feedInBasis).toBe(NEW_ENERGY_FEED_IN_BASIS);
        expect(r.pricing.sourceStatus).toBe('来源待核实');
    });

    it('自发自用：自用电价取工商业平均电价，用户可覆盖', () => {
        const r = resolveWindPrices('浙江', { electricityPrice: 0.7 }, 'self_use_export', NOW);
        expect(r.feedInTariff).toBe(0.4153);
        expect(r.electricityPrice).toBe(0.7);
    });

    it('河北：没有机制电价/合同价就不测算', () => {
        expect(() => resolveWindPrices('河北', {}, 'full_export', NOW)).toThrow('上网电价');
        expect(resolveWindPrices('河北', { feedInTariff: 0.3644 }, 'full_export', NOW).feedInTariff).toBe(0.3644);
    });
});

const post = (handler: (req: Request) => Promise<Response>, body: object) => handler(new Request('http://x/api', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lat: 32, lng: 118.8, capacity: 2000, ...body }),
}));

describe('/api/calculate/storage、/api/calculate/wind 不再写死电价', () => {
    beforeEach(() => { calculateStorage.mockClear(); calculateWind.mockClear(); });

    it('储能：江苏按电价表 1.08 / 0.31（原来写死 1.0 / 0.3），返回电价来源状态', async () => {
        const res = await post(storagePost, { province: '江苏' });
        expect(res.status).toBe(200);
        const input = calculateStorage.mock.calls[0][0];
        expect(input.arbitrageConfig.peakPrice).toBe(1.08);
        expect(input.arbitrageConfig.valleyPrice).toBe(0.31);
        const json = await res.json();
        expect(json.pricing.sourceStatus).toBe('来源待核实');
    });

    it('储能：用户填写的峰谷价优先；河北不填返回 422 中文提示', async () => {
        await post(storagePost, { province: '江苏', peakPrice: 1.3, valleyPrice: 0.2 });
        expect(calculateStorage.mock.calls[0][0].arbitrageConfig).toMatchObject({ peakPrice: 1.3, valleyPrice: 0.2 });
        const res = await post(storagePost, { province: '河北' });
        expect(res.status).toBe(422);
        expect((await res.json()).error).toContain('已取消固定分时');
    });

    it('风电：江苏上网电价取 0.391（原来写死 0.4）；旧参数 electricityPrice 仍可覆盖', async () => {
        const res = await post(windPost, { province: '江苏' });
        expect(res.status).toBe(200);
        expect(calculateWind.mock.calls[0][0].businessModel.feedInTariff).toBe(0.391);
        expect((await res.json()).pricing.feedInBasis).toContain('136');
        await post(windPost, { province: '江苏', electricityPrice: 0.35 });
        expect(calculateWind.mock.calls[1][0].businessModel.feedInTariff).toBe(0.35);
    });

    it('风电：未收录省份且没填电价，返回 422，不按 0.4 兜底', async () => {
        const res = await post(windPost, { province: '新疆' });
        expect(res.status).toBe(422);
        expect(calculateWind).not.toHaveBeenCalled();
    });
});
