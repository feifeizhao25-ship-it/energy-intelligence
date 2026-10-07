/**
 * 成本构成：原来固定按 85/10/5 拆分总投资且无来源。现在是用户可编辑的输入，并明确标注示例比例。
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CostBreakdownEditor, { splitInvestment, EXAMPLE_NOTE, EXAMPLE_SHARES } from './CostBreakdownEditor';

describe('成本构成', () => {
    it('按用户填写的占比拆分总投资', () => {
        const { rows, sumOk } = splitInvestment(1_000_000, { construction: 70, grid: 20, development: 10 });
        expect(rows.map(r => r.amount)).toEqual([700_000, 200_000, 100_000]);
        expect(sumOk).toBe(true);
    });

    it('合计不等于 100% 时提示；负数与非数字按 0', () => {
        const { sum, sumOk, rows } = splitInvestment(100, { construction: 90, grid: -5, development: NaN });
        expect(rows.map(r => r.amount)).toEqual([90, 0, 0]);
        expect(sum).toBe(90);
        expect(sumOk).toBe(false);
    });

    it('默认展示时写明「示例比例，请按实际报价填写」，三项都是可编辑输入框', () => {
        const html = renderToStaticMarkup(<CostBreakdownEditor investment={350_000} />);
        expect(html).toContain(EXAMPLE_NOTE);
        expect(html.match(/<input[^>]*type="number"/g)).toHaveLength(3);
        // 示例值只出现在输入框里，金额随占比计算
        expect(html).toContain(`value="${EXAMPLE_SHARES.construction}"`);
        expect(html).toContain('¥297,500');
    });
});
