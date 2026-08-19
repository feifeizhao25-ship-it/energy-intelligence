/**
 * 今日数据概览组件
 * 显示今日的关键指标：发电量、PR、收益
 */

'use client';

interface TodayOverviewProps {
    data: {
        date: string;
        generation: {
            actual: number;
            expected: number;
            ratio: number;
            change: string;
        };
        pr: {
            value: number;
            valuePercent: number;
            trend: string;
            status: string;
            message: string;
        };
        revenue: {
            actual: number;
            expected: number;
            deviation: number;
            change: string;
        };
    };
}

export default function TodayOverview({ data }: TodayOverviewProps) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'GOOD':
                return 'text-green-500 bg-green-50 dark:bg-green-900/20';
            case 'WARNING':
                return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
            case 'CRITICAL':
                return 'text-red-500 bg-red-50 dark:bg-red-900/20';
            default:
                return 'text-gray-500 bg-gray-50 dark:bg-gray-900/20';
        }
    };

    const getTrendIcon = (change: string) => {
        if (change.startsWith('+')) {
            return (
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
            );
        } else if (change.startsWith('-')) {
            return (
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
            );
        }
        return null;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold">今日数据概览</h2>
                        <p className="text-sm text-green-100 mt-1">{data.date}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-green-100">实时更新</div>
                        <div className="text-xs text-green-200 mt-1">
                            {new Date().toLocaleTimeString('zh-CN')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 发电量 */}
                    <div className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg p-4 transition-all duration-200 border-2 border-transparent hover:border-green-200 dark:hover:border-green-800">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">今日发电</h3>
                            </div>
                            {getTrendIcon(data.generation.change)}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {data.generation.actual.toLocaleString()}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">kWh</span>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">
                                    预期: {data.generation.expected.toLocaleString()} kWh
                                </span>
                                <span className={`font-semibold ${data.generation.change.startsWith('+') ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                    {data.generation.change}
                                </span>
                            </div>

                            {/* 进度条 */}
                            <div className="mt-3">
                                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                                    <span>完成度</span>
                                    <span>{(data.generation.ratio * 100).toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-500 ${data.generation.ratio > 1
                                                ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                                                : 'bg-gradient-to-r from-yellow-400 to-orange-500'
                                            }`}
                                        style={{ width: `${Math.min(data.generation.ratio * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PR */}
                    <div className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg p-4 transition-all duration-200 border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-800">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">性能比PR</h3>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(data.pr.status)}`}>
                                {data.pr.status}
                            </span>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {data.pr.valuePercent.toFixed(1)}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">%</span>
                            </div>

                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                {data.pr.message}
                            </div>

                            {/* PR等级指示器 */}
                            <div className="mt-3 flex items-center gap-1">
                                {[85, 80, 75, 70].map((threshold, idx) => (
                                    <div
                                        key={threshold}
                                        className={`flex-1 h-2 rounded ${data.pr.valuePercent >= threshold
                                                ? idx === 0 ? 'bg-green-500' : idx === 1 ? 'bg-blue-500' : idx === 2 ? 'bg-yellow-500' : 'bg-orange-500'
                                                : 'bg-gray-200 dark:bg-gray-700'
                                            }`}
                                    ></div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                <span>差</span>
                                <span>良好</span>
                                <span>优秀</span>
                            </div>
                        </div>
                    </div>

                    {/* 收益 */}
                    <div className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg p-4 transition-all duration-200 border-2 border-transparent hover:border-yellow-200 dark:hover:border-yellow-800">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">今日收益</h3>
                            </div>
                            {getTrendIcon(data.revenue.change)}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                                    ¥{data.revenue.actual.toFixed(2)}
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">
                                    预期: ¥{data.revenue.expected.toFixed(2)}
                                </span>
                                <span className={`font-semibold ${data.revenue.change.startsWith('+') ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                    {data.revenue.change}
                                </span>
                            </div>

                            {/* 偏差提示 */}
                            <div className={`mt-3 p-2 rounded-lg ${Math.abs(data.revenue.deviation) > 50
                                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                                    : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                }`}>
                                <div className="flex items-center gap-2 text-xs">
                                    {Math.abs(data.revenue.deviation) > 50 ? (
                                        <>
                                            <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <span className="text-yellow-700 dark:text-yellow-300">
                                                偏差较大 ({data.revenue.deviation > 0 ? '+' : ''}{data.revenue.deviation.toFixed(2)}元)
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="text-green-700 dark:text-green-300">
                                                在预期范围内
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
