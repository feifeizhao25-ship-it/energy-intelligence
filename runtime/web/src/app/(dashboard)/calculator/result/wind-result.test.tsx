/**
 * 风电结果页：原来「核心参数回顾」省份显示「未知」、电价说明是泛泛的「用户输入或测算默认值」、装机写 kWp。
 * 现在风电页把省份、装机（kW）、电价来源放进 metadata，结果页如实显示。
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { priceAsOfText } from '@/lib/pricing/tariffs';
import { resolveWindPrices } from '@/lib/pricing/tariff-defaults';

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
    });
});
