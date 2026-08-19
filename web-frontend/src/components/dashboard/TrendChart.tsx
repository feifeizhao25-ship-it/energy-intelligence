/**
 * 趋势图组件
 * 显示7天的PR、发电量、收益趋势
 * 使用简单的SVG绘制，无需额外依赖
 */

'use client';

import { useState } from 'react';

interface TrendChartProps {
    labels: string[];
    prData: number[];
    generationData: number[];
    revenueData: number[];
}

type ChartType = 'pr' | 'generation' | 'revenue';

export default function TrendChart({ labels, prData, generationData, revenueData }: TrendChartProps) {
    const [activeChart, setActiveChart] = useState<ChartType>('pr');

    const getChartData = () => {
        switch (activeChart) {
            case 'pr':
                return { data: prData, label: 'PR (%)', color: '#3b82f6', unit: '%' };
            case 'generation':
                return { data: generationData, label: '发电量 (kWh)', color: '#10b981', unit: ' kWh' };
            case 'revenue':
                return { data: revenueData, label: '收益 (¥)', color: '#f59e0b', unit: '元' };
        }
    };

    const chartData = getChartData();
    const maxValue = Math.max(...chartData.data);
    const minValue = Math.min(...chartData.data);
    const range = maxValue - minValue;

    // 计算点的位置
    const width = 700;
    const height = 300;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = chartData.data.map((value, index) => {
        const x = padding + (index / (chartData.data.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
        return { x, y, value };
    });

    // 创建路径
    const createPath = () => {
        if (points.length === 0) return '';

        let path = `M ${points[0].x} ${points[0].y}`;
        points.forEach((point, index) => {
            if (index > 0) {
                path += ` L ${point.x} ${point.y}`;
            }
        });
        return path;
    };

    // 创建区域填充路径
    const createAreaPath = () => {
        if (points.length === 0) return '';

        let path = `M ${padding} ${padding + chartHeight}`;
        path += ` L ${points[0].x} ${points[0].y}`;
        points.forEach((point, index) => {
            if (index > 0) {
                path += ` L ${point.x} ${point.y}`;
            }
        });
        path += ` L ${points[points.length - 1].x} ${padding + chartHeight}`;
        path += ' Z';
        return path;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">7天趋势</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">过去一周的性能表现</p>
                    </div>

                    {/* Chart Type Selector */}
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <button
                            onClick={() => setActiveChart('pr')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeChart === 'pr'
                                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            PR
                        </button>
                        <button
                            onClick={() => setActiveChart('generation')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeChart === 'generation'
                                    ? 'bg-white dark:bg-gray-600 text-green-600 dark:text-green-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            发电量
                        </button>
                        <button
                            onClick={() => setActiveChart('revenue')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeChart === 'revenue'
                                    ? 'bg-white dark:bg-gray-600 text-yellow-600 dark:text-yellow-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            收益
                        </button>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="p-6">
                <div className="relative">
                    <svg
                        width="100%"
                        height={height}
                        viewBox={`0 0 ${width} ${height}`}
                        className="overflow-visible"
                    >
                        {/* Grid Lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const y = padding + chartHeight * (1 - ratio);
                            const value = minValue + range * ratio;
                            return (
                                <g key={ratio}>
                                    <line
                                        x1={padding}
                                        y1={y}
                                        x2={width - padding}
                                        y2={y}
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        strokeDasharray="4 4"
                                        className="text-gray-200 dark:text-gray-700"
                                    />
                                    <text
                                        x={padding - 10}
                                        y={y}
                                        textAnchor="end"
                                        alignmentBaseline="middle"
                                        className="text-xs fill-gray-500 dark:fill-gray-400"
                                    >
                                        {value.toFixed(activeChart === 'pr' ? 1 : 0)}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Area Fill */}
                        <path
                            d={createAreaPath()}
                            fill={`url(#gradient-${activeChart})`}
                            opacity="0.1"
                        />

                        {/* Line */}
                        <path
                            d={createPath()}
                            fill="none"
                            stroke={chartData.color}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="drop-shadow-lg"
                        />

                        {/* Points */}
                        {points.map((point, index) => (
                            <g key={index}>
                                <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r="6"
                                    fill="white"
                                    stroke={chartData.color}
                                    strokeWidth="3"
                                    className="cursor-pointer hover:r-8 transition-all drop-shadow-md"
                                />
                                <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r="3"
                                    fill={chartData.color}
                                />
                            </g>
                        ))}

                        {/* X-axis Labels */}
                        {labels.map((label, index) => {
                            const x = padding + (index / (labels.length - 1)) * chartWidth;
                            return (
                                <text
                                    key={index}
                                    x={x}
                                    y={height - padding + 25}
                                    textAnchor="middle"
                                    className="text-xs fill-gray-600 dark:fill-gray-400"
                                >
                                    {label}
                                </text>
                            );
                        })}

                        {/* Gradient Definition */}
                        <defs>
                            <linearGradient id={`gradient-${activeChart}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={chartData.color} stopOpacity="0.3" />
                                <stop offset="100%" stopColor={chartData.color} stopOpacity="0" />
                            </linearGradient>
                        </defs>
                    </svg>

                    {/* Hover Tooltip (可以后续添加) */}
                </div>

                {/* Statistics */}
                <div className="mt-6 grid grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="text-xs text-gray-600 dark:text-gray-400">最大值</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                            {maxValue.toFixed(activeChart === 'pr' ? 1 : 0)}
                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">{chartData.unit}</span>
                        </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="text-xs text-gray-600 dark:text-gray-400">最小值</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                            {minValue.toFixed(activeChart === 'pr' ? 1 : 0)}
                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">{chartData.unit}</span>
                        </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="text-xs text-gray-600 dark:text-gray-400">平均值</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                            {(chartData.data.reduce((a, b) => a + b, 0) / chartData.data.length).toFixed(activeChart === 'pr' ? 1 : 0)}
                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">{chartData.unit}</span>
                        </div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="text-xs text-gray-600 dark:text-gray-400">波动范围</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                            {range.toFixed(activeChart === 'pr' ? 1 : 0)}
                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">{chartData.unit}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
