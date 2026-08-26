/**
 * 项目Dashboard - 实时监测页面
 * 这是用户每天回来看的核心功能！
 * 
 * 功能：
 * - 今日数据概览（发电量/PR/收益/健康度）
 * - 7天趋势图
 * - 异常告警
 * - 运维建议
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TodayOverview from '@/components/dashboard/TodayOverview';
import TrendChart from '@/components/dashboard/TrendChart';
import AlertList from '@/components/dashboard/AlertList';
import MaintenanceTasks from '@/components/dashboard/MaintenanceTasks';
import HealthScore from '@/components/dashboard/HealthScore';

interface DashboardData {
    today: {
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
        healthScore: {
            value: number;
            grade: string;
            trend: string;
        };
    };
    trend: {
        labels: string[];
        prData: number[];
        generationData: number[];
        revenueData: number[];
    };
    alerts: Array<{
        id: string;
        type: string;
        severity: string;
        title: string;
        description: string;
        recommendation: string;
        createdAt: string;
        status: string;
    }>;
    maintenancePlan: {
        weekOf: string;
        tasks: Array<{
            priority: string;
            action: string;
            reason: string;
            estimatedCost: number;
            estimatedGain: number;
            roi: string;
            recommendedDate: string;
            completed: boolean;
        }>;
    };
    summary: {
        activatedAt: string;
        totalDaysMonitored: number;
        dataPointsCollected: number;
        anomaliesDetected: number;
        alertsSent: number;
        reportsGenerated: number;
    };
}

export default function ProjectDashboard() {
    const params = useParams();
    const projectId = params.id as string;

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // 获取Dashboard数据
    useEffect(() => {
        fetchDashboardData();

        // 每5分钟自动刷新
        const interval = setInterval(() => {
            fetchDashboardData();
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [projectId]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/v2/project/${projectId}/dashboard`);

            if (!response.ok) {
                throw new Error('获取数据失败');
            }

            const result = await response.json();

            if (result.success) {
                setData(result.data);
                setLastUpdated(new Date());
                setError(null);
            } else {
                throw new Error(result.error || '获取数据失败');
            }
        } catch (err: any) {
            console.error('获取Dashboard数据失败:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">加载中...</p>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                    <button
                        onClick={fetchDashboardData}
                        className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                        重试
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                项目实时监测
                            </h1>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                最后更新: {lastUpdated.toLocaleString('zh-CN')}
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* 刷新按钮 */}
                            <button
                                onClick={fetchDashboardData}
                                disabled={loading}
                                className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                            >
                                <svg className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                刷新数据
                            </button>

                            {/* 导出报告按钮 */}
                            <button className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                导出报告
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-6">
                    {/* 今日数据概览 */}
                    {data && (
                        <>
                            <TodayOverview data={data.today} />

                            {/* 健康度评分 */}
                            <HealthScore
                                score={data.today.healthScore.value}
                                grade={data.today.healthScore.grade}
                                trend={data.today.healthScore.trend}
                            />

                            {/* 趋势图 */}
                            <TrendChart
                                labels={data.trend.labels}
                                prData={data.trend.prData}
                                generationData={data.trend.generationData}
                                revenueData={data.trend.revenueData}
                            />

                            {/* 两列布局：告警 + 运维 */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* 异常告警 */}
                                <AlertList alerts={data.alerts} />

                                {/* 运维计划 */}
                                <MaintenanceTasks
                                    weekOf={data.maintenancePlan.weekOf}
                                    tasks={data.maintenancePlan.tasks}
                                />
                            </div>

                            {/* 项目统计概览 */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    监测统计
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-green-500">{data.summary.totalDaysMonitored}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">监测天数</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-500">{data.summary.dataPointsCollected}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">数据点数</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-yellow-500">{data.summary.anomaliesDetected}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">检测到异常</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-orange-500">{data.summary.alertsSent}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">发送告警</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-purple-500">{data.summary.reportsGenerated}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">生成报告</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-gray-500">
                                            {Math.ceil((Date.now() - new Date(data.summary.activatedAt).getTime()) / (1000 * 60 * 60 * 24))}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">激活天数</div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
