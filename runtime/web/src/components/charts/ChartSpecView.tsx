'use client';

import { useEffect, useId, useRef } from 'react';
import { parseChartSpec, specToTable, type ChartSpec } from '@/lib/charts/chart-spec';

const TYPE_LABEL: Record<ChartSpec['type'], string> = {
    line: '折线',
    bar: '柱',
    stack: '堆叠',
    heatmap: '热力',
    sankey: '桑基',
    gauge: '仪表',
    scatter: '散点',
};

function optionOf(spec: ChartSpec) {
    return {
        title: { text: spec.title, left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'axis' as const },
        xAxis: { type: 'category' as const, data: spec.series[0].data.map((_, index) => String(index + 1)) },
        yAxis: { type: 'value' as const, name: spec.unit },
        series: spec.series.map((item) => ({
            type: spec.type === 'line' || spec.type === 'scatter' ? spec.type : 'bar',
            name: item.name,
            stack: spec.type === 'stack' ? '合计' : undefined,
            data: item.data.map((value) => (typeof value === 'number' ? value : Array.isArray(value) ? value[1] : value.value)),
        })),
    };
}

export function ChartSpecView({ source }: { source: unknown }) {
    const parsed = parseChartSpec(source);
    const host = useRef<HTMLDivElement>(null);
    const labelId = useId();
    const fingerprint = JSON.stringify(source);
    useEffect(() => {
        const current = parseChartSpec(source);
        if (!current.ok || !host.current) return;
        let disposed = false;
        let chart: { dispose: () => void } | null = null;
        import('echarts').then((echarts) => {
            if (disposed || !host.current) return;
            const instance = echarts.init(host.current, undefined, { renderer: 'svg' });
            instance.setOption(optionOf(current.spec));
            chart = instance;
        }).catch(() => undefined);
        return () => {
            disposed = true;
            chart?.dispose();
        };
    }, [fingerprint, source]);
    if (!parsed.ok) {
        return <p role="alert">{parsed.message}</p>;
    }
    const table = specToTable(parsed.spec);
    return (
        <figure aria-labelledby={labelId} className="space-y-2">
            <figcaption id={labelId} className="text-sm font-semibold">{parsed.spec.title}（{TYPE_LABEL[parsed.spec.type]}，单位 {parsed.spec.unit}）</figcaption>
            <div ref={host} className="h-56 w-full" />
            <table className="w-full text-left text-sm">
                <tbody>
                    {table.map((row, index) => (
                        <tr key={row.join('-')}>{row.map((cell) => index === 0 ? <th key={cell} className="border-b px-2 py-1">{cell}</th> : <td key={cell} className="px-2 py-1 tabular-nums">{cell}</td>)}</tr>
                    ))}
                </tbody>
            </table>
        </figure>
    );
}

export function chartSvg(spec: ChartSpec): string {
    const width = 320;
    const height = 120;
    const values = spec.series[0].data.map((value) => (typeof value === 'number' ? value : Array.isArray(value) ? value[1] : value.value));
    const max = Math.max(...values, 1);
    const step = width / values.length;
    const bars = values.map((value, index) => {
        const barHeight = (value / max) * (height - 20);
        return `<rect x="${index * step + 4}" y="${height - barHeight}" width="${Math.max(step - 8, 2)}" height="${barHeight}" fill="currentColor" />`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${spec.title}">${bars}</svg>`;
}
