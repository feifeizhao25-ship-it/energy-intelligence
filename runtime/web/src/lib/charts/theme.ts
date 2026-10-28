import type { ChartSpec } from '@/lib/charts/chart-spec';

/** 色相拉开，不单靠红绿区分序列。 */
export const CHART_COLORS = ['#0F766E', '#0B3A4A', '#C2410C', '#1D4E89', '#6D597A', '#A16207', '#3F6212', '#9F1239'];

export function chartFootnote(spec: Pick<ChartSpec, 'source' | 'asOf'>) {
    return {
        source: spec.source || '未随图表给出',
        asOf: spec.asOf || '未标注',
    };
}

function pointValue(value: ChartSpec['series'][number]['data'][number]) {
    if (typeof value === 'number') return value;
    if (Array.isArray(value)) return value[1];
    return value.value;
}

export function chartOption(spec: ChartSpec) {
    const note = chartFootnote(spec);
    return {
        color: CHART_COLORS,
        title: { text: spec.title, left: 'center', textStyle: { fontSize: 14, color: '#102033' } },
        tooltip: {
            trigger: 'axis' as const,
            valueFormatter: (value: unknown) => `${value ?? ''} ${spec.unit}`,
        },
        legend: { bottom: 0, textStyle: { color: '#52606D' } },
        grid: { left: 48, right: 16, top: 40, bottom: 48, containLabel: true },
        xAxis: {
            type: 'category' as const,
            name: '序号',
            data: spec.series[0].data.map((_, index) => String(index + 1)),
            nameTextStyle: { color: '#52606D' },
            axisLabel: { color: '#52606D' },
        },
        yAxis: {
            type: 'value' as const,
            name: spec.unit,
            nameTextStyle: { color: '#52606D' },
            axisLabel: { color: '#52606D' },
        },
        series: spec.series.map((item) => ({
            type: spec.type === 'line' || spec.type === 'scatter' ? spec.type : 'bar',
            name: item.name,
            stack: spec.type === 'stack' ? '合计' : undefined,
            data: item.data.map((value) => pointValue(value)),
        })),
        footnote: `来源：${note.source}。数据日期：${note.asOf}。`,
    };
}
