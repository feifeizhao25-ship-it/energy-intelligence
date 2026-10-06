import {
    TARIFFS, lookupTariff, tariffFreshness, provincesWithPrices, priceAsOfText,
    MARKET_TOU_NOTICE, NO_PROVINCE_DATA,
} from './tariffs';
import { AI_TOOLS } from '@/lib/ai/tools';

jest.mock('@/lib/prisma', () => ({ prisma: {} }));

/** 发改能源规〔2025〕1656 号，2026-03-01 起已取消固定分时的 9 个省份 */
const MARKET_PROVINCES = ['贵州', '河北', '湖北', '陕西', '吉林', '云南', '重庆', '辽宁', '河南'];

describe('统一电价表', () => {
    it('每个条目都有 source / effectiveDate / asOf 字段；未核实的明确写「来源待核实」', () => {
        for (const [key, t] of Object.entries(TARIFFS)) {
            expect(t.province).toBe(key);
            expect(t.source.length).toBeGreaterThan(0);
            expect('effectiveDate' in t).toBe(true);
            expect('asOf' in t).toBe(true);
            if (!t.sourceVerified) expect(t.source).toContain('来源待核实');
        }
    });

    it.each(MARKET_PROVINCES)('%s：已取消固定分时，不输出峰谷时段和价格', (province) => {
        const t = TARIFFS[province];
        expect(t.touStatus).toBe('market');
        expect(t.peaks).toBeUndefined();
        expect(t.valleys).toBeUndefined();
        expect(t.peak).toBeUndefined();
        expect(t.valley).toBeUndefined();
        expect(t.source).toContain('发改能源规〔2025〕1656 号');
        const found = lookupTariff(province);
        expect(found.status).toBe('market');
        if (found.status === 'market') expect(found.message).toContain(MARKET_TOU_NOTICE);
    });

    it('查不到的省份返回「暂无该省数据」', () => {
        const found = lookupTariff('新疆');
        expect(found.status).toBe('missing');
        if (found.status === 'missing') expect(found.message).toBe(NO_PROVINCE_DATA);
    });

    it('收录价格的省份正好 6 个（首页「覆盖省份」须与此一致）', () => {
        expect(provincesWithPrices().sort()).toEqual(['上海', '北京', '山东', '广东', '江苏', '浙江'].sort());
    });

    it('数据截至：超过 90 天提示「可能已变化」，90 天内不提示；只写年份的按年末算', () => {
        expect(tariffFreshness('2025-12-01', new Date('2026-01-15T00:00:00Z'))).toEqual({ label: '电价数据截至 2025-12', stale: false, staleNote: null });
        expect(tariffFreshness('2025-12-01', new Date('2026-10-06T00:00:00Z')).stale).toBe(true);
        expect(tariffFreshness('2024', new Date('2025-02-01T00:00:00Z'))).toEqual({ label: '电价数据截至 2024 年', stale: false, staleNote: null });
        expect(tariffFreshness(null).label).toBe('电价数据截至：未标注');
        expect(priceAsOfText({ asOfLabel: '电价数据截至 2025-12', staleNote: '可能已变化，请以最新文件为准', source: '来源待核实' }))
            .toBe('电价数据截至 2025-12，可能已变化，请以最新文件为准（来源：来源待核实）');
    });

    it('AI 工具 get_electricity_price 读同一张表：江苏谷价 0.31；查不到不再按北京返回', async () => {
        const js: any = await AI_TOOLS.get_electricity_price.handler({ region: '江苏', type: 'commercial' });
        expect(js.prices.valley).toBe(0.31);
        expect(js.asOfLabel).toBe('电价数据截至 2025-12');
        const unknown: any = await AI_TOOLS.get_electricity_price.handler({ region: '新疆' });
        expect(unknown.success).toBe(false);
        expect(unknown.message).toBe('暂无该省数据');
        expect(JSON.stringify(unknown)).not.toContain('0.4883');
        const hebei: any = await AI_TOOLS.get_electricity_price.handler({ region: '河北' });
        expect(hebei.touStatus).toBe('market');
        expect(hebei.peaks).toBeUndefined();
    });
});
