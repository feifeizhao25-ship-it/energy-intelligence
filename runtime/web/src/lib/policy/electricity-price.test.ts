// 测算用电价配置：只读 lib/pricing/tariffs.ts 一张表
import { getPriceConfig } from './electricity-price';
import { getLatestPrice } from '@/lib/crawler/price-crawler';
import { TARIFFS, TariffUnavailableError } from '@/lib/pricing/tariffs';

const NOW = new Date('2026-10-06T00:00:00Z');

describe('getPriceConfig 读统一电价表', () => {
    it('江苏：峰谷价与 getLatestPrice 一致（此前两张表的谷价 0.25 与 0.31 矛盾）', async () => {
        const config = getPriceConfig('江苏', NOW);
        const latest = await getLatestPrice('江苏');
        expect(config.valleyPrice).toBe(0.31);
        expect(latest.valley).toBe(config.valleyPrice);
        expect(latest.peak).toBe(config.peakPrice);
        expect(config.valleyPrice).toBe(TARIFFS['江苏'].valley);
        // 手算平均电价：(1.08×4 + 0.64×8 + 0.31×12) ÷ 24 = 13.16 ÷ 24 = 0.5483
        expect(config.retailPrice).toBeCloseTo(0.5483, 4);
    });

    it('带来源与数据截至；2025-12 的数据在 2026-10 已超过 90 天', () => {
        const config = getPriceConfig('浙江', NOW);
        expect(config.source).toContain('来源待核实');
        expect(config.asOf).toBe('2025-12-05');
        expect(config.freshness.label).toBe('电价数据截至 2025-12');
        expect(config.freshness.stale).toBe(true);
        expect(config.freshness.staleNote).toBe('可能已变化，请以最新文件为准');
    });

    it('「江苏省」也能查到', () => {
        expect(getPriceConfig('江苏省', NOW).province).toBe('江苏');
    });

    it('查不到的省份抛出「暂无该省数据」，不再按通用 0.75 元或北京兜底', () => {
        expect(() => getPriceConfig('西藏', NOW)).toThrow(TariffUnavailableError);
        expect(() => getPriceConfig('西藏', NOW)).toThrow('暂无该省数据');
    });

    it('已取消固定分时的省份（含河北）不出写死时段，提示输入合同电价', () => {
        expect(() => getPriceConfig('河北', NOW)).toThrow('已取消固定分时，按市场化交易价格测算，请输入合同电价');
        expect(() => getPriceConfig('河南', NOW)).toThrow('1656');
    });

    it('getLatestPrice 对已取消固定分时的省份同样拒绝', async () => {
        await expect(getLatestPrice('湖北')).rejects.toThrow('请输入合同电价');
        await expect(getLatestPrice('西藏')).rejects.toThrow('暂无该省数据');
    });
});
