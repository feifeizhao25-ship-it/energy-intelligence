/**
 * 风电结果页：原来「核心参数回顾」省份显示「未知」、电价说明是泛泛的「用户输入或测算默认值」、装机写 kWp。
 * 现在风电页把省份、装机（kW）、电价来源放进 metadata，结果页如实显示。
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { priceAsOfText } from '@/lib/pricing/tariffs';
import { resolveWindPrices } from '@/lib/pricing/tariff-defaults';
import { formatPercentRange, formatRange, type NullableRange, type ValueRange } from '@/lib/calculator/ranges';

let searchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => searchParams, useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('next/dynamic', () => () => () => null);
jest.mock('@/components/calculator/InvestmentReport', () => () => null);
jest.mock('@/components/calculator/AIProjectAnalysis', () => () => null);

const NOW = new Date('2026-10-10T01:00:00Z');

describe('风电电价说明', () => {
    it('河北、用户填了上网电价：写明数值、是用户填写、省份', () => {
        const { pricing } = resolveWindPrices('河北', { feedInTariff: 0.3644 }, 'full_export', NOW);
        expect(priceAsOfText(pricing)).toBe('电价：上网电价 0.3644 元/度（你填写的数值，省份：河北）');
    });
    it('江苏、用电价表参考：写明数值与来源状态、数据截至', () => {
        const { pricing } = resolveWindPrices('江苏', {}, 'full_export', NOW);
        const text = priceAsOfText(pricing);
        expect(text).toMatch(/^电价：上网电价 0\.391 元\/度；电价数据截至 2025-12/);
        expect(text).toContain('来源待核实');
    });
});

describe('风电结果页', () => {
    it('核心参数回顾显示省份与 kW，电价说明不是泛泛的默认文字', async () => {
        const { default: ResultPage } = await import('./page');
        const { pricing } = resolveWindPrices('河北', { feedInTariff: 0.3644 }, 'full_export', NOW);
        const data = {
            energy: { year1: 6_100_000, monthly: Array(12).fill(500_000), lifetime: 120_000_000, equivalentHours: 2033 },
            financial: { irr: 7.1, paybackYears: 10.2, lcoe: 0.29, investment: 19_500_000 },
            pricing,
            metadata: { projectName: '河北分散式风电项目', province: '河北', capacity: 3000, pricing },
        };
        searchParams = new URLSearchParams({ type: 'wind', data: JSON.stringify(data) });
        const html = renderToStaticMarkup(<ResultPage />);
        expect(html).toContain('3000 kW');
        expect(html).not.toContain('kWp');
        expect(html).toMatch(/省份<\/span><span[^>]*>河北/);
        expect(html).toContain('上网电价 0.3644 元/度（你填写的数值，省份：河北）');
        expect(html).not.toContain('用户输入或测算默认值');
        expect(html).toContain('轮毂高度');
        expect(html).toContain('功率曲线');
        expect(html).toContain('GB/T 18710《风电场风能资源评估方法》');
        expect(html).toContain('IEC 61400-12-1');
        expect(html).not.toContain('光伏发电站设计标准');
        expect(html).not.toContain('倾斜面年辐照');
    });

    it('光伏结果仍用光伏算法说明', async () => {
        const html = await renderResult('solar', resultData());
        expect(html).toContain('倾斜面年辐照');
        expect(html).toContain('光伏发电站设计标准（2024 年版）');
        expect(html).not.toContain('轮毂高度');
    });
});

function resultData(extra: Record<string, unknown> = {}) {
    return {
        energy: { year1: 6_100_000, monthly: Array(12).fill(500_000), lifetime: 120_000_000, equivalentHours: 2033 },
        financial: { irr: 7.1, paybackYears: 10.2, lcoe: 0.29, investment: 19_500_000 },
        metadata: { projectName: '河北分散式风电项目', province: '河北', capacity: 3000 },
        ...extra,
    };
}

async function renderResult(type: string, data: unknown) {
    const { default: ResultPage } = await import('./page');
    searchParams = new URLSearchParams({ type, data: JSON.stringify(data) });
    return renderToStaticMarkup(<ResultPage />);
}

describe('测算结果页的 IRR / LCOE 区间', () => {
    const irr: NullableRange = { low: 5.2, median: 7.1, high: 9.4, relUncertainty: 0.15, note: '已有模型区间' };
    const lcoe: ValueRange = { low: 0.246, median: 0.29, high: 0.341, relUncertainty: 0.15, note: '已有模型区间' };

    it('有 ranges 时展示区间文本，不再渲染单点 toFixed', async () => {
        const html = await renderResult('wind', resultData({ ranges: { irr, lcoe } }));
        expect(html).toContain(formatPercentRange(irr));
        expect(html).toContain(formatRange(lcoe, '元/度', { decimals: 3 }));
        expect(html).not.toContain('7.10%');
        expect(html).not.toContain('¥0.290');
        expect(html).toContain('10.2年');
    });

    it('payload 已带 text 时沿用该文本', async () => {
        const html = await renderResult('wind', resultData({
            ranges: {
                irr: { ...irr, text: '约 5.2%–9.4%（中值 7.1%）' },
                lcoe: { ...lcoe, text: '约 0.246–0.341 元/度（中值 0.290）' },
            },
        }));
        expect(html).toContain('约 5.2%–9.4%（中值 7.1%）');
        expect(html).toContain('约 0.246–0.341 元/度（中值 0.290）');
        expect(html).not.toContain('7.10%');
        expect(html).not.toContain('¥0.290');
    });

    it('没有 ranges 时显示无法确认，不回退成单点', async () => {
        const html = await renderResult('wind', resultData());
        expect(html).toContain('无法确认');
        expect(html).not.toContain('7.10%');
        expect(html).not.toContain('¥0.290');
        expect(html).toContain('10.2年');
    });

    it('IRR 中值为空时显示无唯一解', async () => {
        const html = await renderResult('wind', resultData({
            ranges: {
                irr: { low: null, median: null, high: null, relUncertainty: 0.15, note: '已有模型区间' },
                lcoe,
            },
        }));
        expect(html).toContain('无唯一解');
        expect(html).not.toContain('7.10%');
        expect(html).toContain(formatRange(lcoe, '元/度', { decimals: 3 }));
    });

    it('已有回收期区间时一并显示，储能卡片用 LCOS', async () => {
        const payback: ValueRange = { low: 8.7, median: 10.2, high: 12.0, relUncertainty: 0.15, note: '已有模型区间' };
        const lcos: ValueRange = { low: 0.41, median: 0.48, high: 0.55, relUncertainty: 0.1, note: '已有模型区间' };
        const html = await renderResult('storage', resultData({
            ranges: { irr, lcos, paybackYears: payback },
        }));
        expect(html).toContain(formatRange(payback, '年', { decimals: 1 }));
        expect(html).not.toContain('10.2年');
        expect(html).toContain('平准化储能成本（LCOS）');
        expect(html).toContain(formatRange(lcos, '元/度', { decimals: 3 }));
        expect(html).not.toContain('平准化度电成本（LCOE）');
    });
});
