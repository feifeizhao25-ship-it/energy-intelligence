import { z } from 'zod';

export const CHART_TYPES = ['line', 'bar', 'stack', 'heatmap', 'sankey', 'gauge', 'scatter'] as const;

const point = z.union([
    z.number(),
    z.tuple([z.number(), z.number()]),
    z.object({ name: z.string(), value: z.number() }).strict(),
]);

export const chartSpecSchema = z.object({
    type: z.enum(CHART_TYPES),
    title: z.string().min(1).max(40),
    unit: z.string().min(1).max(20),
    source: z.string().min(1).max(80).optional(),
    asOf: z.string().min(1).max(20).optional(),
    series: z.array(z.object({
        name: z.string().min(1).max(40),
        data: z.array(point).min(1).max(500),
    })).min(1).max(8),
}).strict();

export type ChartSpec = z.infer<typeof chartSpecSchema>;

export function parseChartSpec(input: unknown): { ok: true; spec: ChartSpec } | { ok: false; message: '图表数据无效' } {
    const parsed = chartSpecSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: '图表数据无效' };
    const points = parsed.data.series.reduce((sum, item) => sum + item.data.length, 0);
    if (points > 500) return { ok: false, message: '图表数据无效' };
    return { ok: true, spec: parsed.data };
}

export function specToTable(spec: ChartSpec): string[][] {
    const header = ['名称', ...spec.series.map((item) => item.name)];
    const length = Math.max(...spec.series.map((item) => item.data.length));
    const rows = [header];
    for (let index = 0; index < length; index += 1) {
        rows.push([
            String(index + 1),
            ...spec.series.map((item) => {
                const value = item.data[index];
                if (typeof value === 'number') return String(value);
                if (Array.isArray(value)) return String(value[1]);
                return value ? String(value.value) : '';
            }),
        ]);
    }
    return rows;
}
