'use client';

import React, { useMemo } from 'react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StationRecord {
    date: string;
    generation: number;
    revenue: number;
    weather?: string;
}

interface StationChartsProps {
    records: StationRecord[];
    stationType: 'solar' | 'wind' | 'storage';
    period: 'week' | 'month' | 'year';
}

const typeColors = {
    solar: { primary: '#F59E0B', secondary: '#FEF3C7' },
    wind: { primary: '#3B82F6', secondary: '#DBEAFE' },
    storage: { primary: '#8B5CF6', secondary: '#EDE9FE' },
};

export default function StationCharts({
    records,
    stationType,
    period
}: StationChartsProps) {
    const colors = typeColors[stationType];

    // 处理数据
    const chartData = useMemo(() => {
        return records.map(record => ({
            ...record,
            dateLabel: formatDateLabel(record.date, period),
        }));
    }, [records, period]);

    // 计算统计数据
    const stats = useMemo(() => {
        if (records.length === 0) return null;

        const totalGeneration = records.reduce((sum, r) => sum + r.generation, 0);
        const totalRevenue = records.reduce((sum, r) => sum + r.revenue, 0);
        const avgGeneration = totalGeneration / records.length;

        // 对比上一周期
        const halfPoint = Math.floor(records.length / 2);
        const recentAvg = records.slice(halfPoint).reduce((sum, r) => sum + r.generation, 0) / (records.length - halfPoint);
        const previousAvg = records.slice(0, halfPoint).reduce((sum, r) => sum + r.generation, 0) / halfPoint;
        const trend = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

        return {
            totalGeneration,
            totalRevenue,
            avgGeneration,
            trend,
            maxGeneration: Math.max(...records.map(r => r.generation)),
            minGeneration: Math.min(...records.map(r => r.generation)),
        };
    }, [records]);

    if (records.length === 0) {
        return (
            <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">暂无数据</h3>
                <p className="text-sm text-slate-500">开始录入发电数据，查看趋势图表</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="累计发电"
                    value={`${stats!.totalGeneration.toLocaleString()}`}
                    unit="kWh"
                    color={colors.primary}
                />
                <StatCard
                    label="累计收益"
                    value={`¥${(stats!.totalRevenue / 10000).toFixed(2)}`}
                    unit="万"
                    color="#22C55E"
                />
                <StatCard
                    label="日均发电"
                    value={stats!.avgGeneration.toFixed(1)}
                    unit="kWh"
                    color={colors.primary}
                />
                <StatCard
                    label="趋势"
                    value={`${stats!.trend >= 0 ? '+' : ''}${stats!.trend.toFixed(1)}%`}
                    trend={stats!.trend}
                    color={stats!.trend >= 0 ? '#22C55E' : '#EF4444'}
                />
            </div>

            {/* Generation Chart */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6">
                <h3 className="font-bold text-slate-900 mb-4">发电量趋势</h3>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="generationGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis
                                dataKey="dateLabel"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94A3B8', fontSize: 12 }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94A3B8', fontSize: 12 }}
                                tickFormatter={(value) => `${value}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #E2E8F0',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                }}
                                formatter={(value: number) => [`${value.toLocaleString()} kWh`, '发电量']}
                            />
                            <Area
                                type="monotone"
                                dataKey="generation"
                                stroke={colors.primary}
                                strokeWidth={3}
                                fill="url(#generationGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Revenue Chart */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6">
                <h3 className="font-bold text-slate-900 mb-4">收益趋势</h3>
                <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                            <XAxis
                                dataKey="dateLabel"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94A3B8', fontSize: 12 }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94A3B8', fontSize: 12 }}
                                tickFormatter={(value) => `¥${value}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #E2E8F0',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                }}
                                formatter={(value: number) => [`¥${value.toFixed(2)}`, '收益']}
                            />
                            <Bar
                                dataKey="revenue"
                                fill="#22C55E"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

// Stat Card Component
function StatCard({
    label,
    value,
    unit,
    color,
    trend,
}: {
    label: string;
    value: string;
    unit?: string;
    color: string;
    trend?: number;
}) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">
                {label}
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black" style={{ color }}>{value}</span>
                {unit && <span className="text-sm text-slate-400">{unit}</span>}
            </div>
            {trend !== undefined && (
                <div className={cn(
                    "flex items-center gap-1 mt-1 text-xs font-bold",
                    trend >= 0 ? "text-green-500" : "text-red-500"
                )}>
                    {trend > 0 ? <TrendingUp className="w-3 h-3" /> :
                        trend < 0 ? <TrendingDown className="w-3 h-3" /> :
                            <Minus className="w-3 h-3" />}
                    <span>vs 上期</span>
                </div>
            )}
        </div>
    );
}

// Helper function
function formatDateLabel(dateStr: string, period: 'week' | 'month' | 'year'): string {
    const date = new Date(dateStr);
    switch (period) {
        case 'week':
            return `${date.getMonth() + 1}/${date.getDate()}`;
        case 'month':
            return `${date.getDate()}日`;
        case 'year':
            return `${date.getMonth() + 1}月`;
        default:
            return dateStr;
    }
}
