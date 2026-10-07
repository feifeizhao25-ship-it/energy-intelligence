/**
 * 结果页月度发电量柱状图：数据已经在 energy.monthly 里，原实现的柱子用百分比高度、父元素却没有高度，
 * 渲染出来全是 0 像素（空图）。这里锁定：有数据时 12 根柱子都有像素高度；整页渲染时同样如此。
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MonthlyGenerationBarChart, { monthlyBarHeights, normalizeMonthly } from './MonthlyGenerationBarChart';

const monthly = [8100, 9000, 11800, 13200, 14500, 13900, 14100, 13600, 11900, 10500, 8600, 7700];

function barHeights(html: string): number[] {
    return [...html.matchAll(/data-testid="monthly-bar"[^>]*style="height:(\d+)px"/g)].map(m => Number(m[1]));
}

describe('月度发电量柱状图', () => {
    it('按像素计算柱高：最大月 = 柱区高度，其余按比例', () => {
        expect(monthlyBarHeights([50, 100, 0], 200)).toEqual([100, 200, 0]);
        expect(monthlyBarHeights([1, 10000], 200)).toEqual([2, 200]); // 很小的月份至少 2 像素
    });

    it('全部为 0 或没有数据时不产生 NaN，显示说明文字', () => {
        expect(monthlyBarHeights([0, 0, 0], 200)).toEqual([0, 0, 0]);
        const html = renderToStaticMarkup(<MonthlyGenerationBarChart data={{ monthly: [] }} />);
        expect(html).toContain('没有返回月度发电量');
        expect(html).not.toContain('NaN');
    });

    it('整理数据：字符串数字可用，缺月与非法值记为缺失', () => {
        const result = normalizeMonthly({ monthly: ['100', null, -5, 'x', 200] });
        expect(result.values.slice(0, 5)).toEqual([100, 0, 0, 0, 200]);
        expect(result.missing.slice(0, 6)).toEqual([false, true, true, true, false, true]);
    });

    it('energy 对象传入：12 根柱子都有非零像素高度', () => {
        const html = renderToStaticMarkup(<MonthlyGenerationBarChart data={{ monthly }} theme="dark" barAreaPx={200} />);
        const heights = barHeights(html);
        expect(heights).toHaveLength(12);
        expect(heights.every(h => h > 0)).toBe(true);
        expect(Math.max(...heights)).toBe(200); // 5 月最大
        expect(html).not.toMatch(/height:\s*\d+(\.\d+)?%/);
    });
});

// ---- 整页：/calculator/result 用 URL 里的 data 渲染图表 ----
let searchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => searchParams, useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('next/dynamic', () => () => () => null);
jest.mock('@/components/calculator/InvestmentReport', () => () => null);
jest.mock('@/components/calculator/AIProjectAnalysis', () => () => null);

describe('测算结果页', () => {
    it('光伏测算结果（/api/calculate/solar 的返回）传到结果页后，月度柱状图有 12 根非空柱子', async () => {
        const { default: ResultPage } = await import('@/app/(dashboard)/calculator/result/page');
        const data = {
            energy: { year1: 136_900, monthly, lifetime: 3_200_000, equivalentHours: 1369 },
            financial: { irr: 8.2, paybackYears: 9.1, lcoe: 0.31, investment: 350_000 },
            metadata: { projectName: '测试光伏项目', province: '江苏', capacity: 100 },
        };
        searchParams = new URLSearchParams({ type: 'solar', data: JSON.stringify(data) });
        const html = renderToStaticMarkup(<ResultPage />);
        expect(html).toContain('月度发电量（估算）');
        const heights = barHeights(html);
        expect(heights).toHaveLength(12);
        expect(heights.every(h => h > 0)).toBe(true);
        // 成本构成不再写死 85/10/5：只作为可编辑输入的示例值，并标注「示例比例，请按实际报价填写」
        expect(html).toContain('示例比例，请按实际报价填写');
        expect(html).toContain('id="cost-construction"');
    });
});
