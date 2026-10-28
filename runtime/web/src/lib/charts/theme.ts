import type { ChartSpec } from '@/lib/charts/chart-spec';

/** AntV 分类色。明暗交替，单图高亮不超过 8 个，不用红绿成对表示涨跌。 */
export const CHART_COLORS = ['#5B8FF9', '#61DDAA', '#65789B', '#F6BD16', '#7262FD', '#78D3F8', '#9661BC', '#F6903D', '#008685', '#F08BB4'];

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
    const barLike = spec.type !== 'line' && spec.type !== 'scatter';
    return {
        color: CHART_COLORS.slice(0, 8),
        aria: { enabled: true, decal: { show: true } },
        title: { text: spec.title, left: 'center', textStyle: { fontSize: 14, fontWeight: 500, color: '#0E2A2B' } },
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
            nameTextStyle: { color: '#0E2A2B' },
            axisLabel: { color: '#3E5C5A' },
        },
        yAxis: {
            type: 'value' as const,
            name: spec.unit,
            min: barLike ? 0 : undefined,
            nameTextStyle: { color: '#0E2A2B' },
            axisLabel: { color: '#3E5C5A' },
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
