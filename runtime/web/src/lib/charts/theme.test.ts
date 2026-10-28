import { chartFootnote, chartOption, CHART_COLORS } from '@/lib/charts/theme';
import { parseChartSpec } from '@/lib/charts/chart-spec';

describe('图表主题', () => {
    it('纵轴带单位，并始终留下来源和数据日期', () => {
        const parsed = parseChartSpec({
            type: 'bar',
            title: '示例',
            unit: '千瓦时',
            series: [{ name: '甲', data: [1, 2] }],
        });
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        const option = chartOption(parsed.spec);
        expect(option.yAxis.name).toBe('千瓦时');
        expect(option.xAxis.name).toBe('序号');
        expect(option.color).toEqual(CHART_COLORS);
        expect(chartFootnote(parsed.spec)).toEqual({ source: '未随图表给出', asOf: '未标注' });
        const dated = parseChartSpec({
            type: 'line',
            title: '示例',
            unit: '千瓦时',
            source: '省级电价表',
            asOf: '2026-10-27',
            series: [{ name: '甲', data: [1] }],
        });
        expect(dated.ok).toBe(true);
        if (!dated.ok) return;
        expect(chartFootnote(dated.spec).source).toBe('省级电价表');
        expect(chartFootnote(dated.spec).asOf).toBe('2026-10-27');
    });
});
