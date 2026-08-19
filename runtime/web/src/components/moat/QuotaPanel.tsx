'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Zap, Brain, FileText, BarChart3, Search, BookOpen,
    Sparkles, TrendingUp, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * 配额使用面板组件
 * 护城河：成本与配额管理
 */

interface QuotaUsage {
    type: string;
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
    resetsAt?: string;
    exceeded: boolean;
}

interface QuotaPanelProps {
    onUpgrade?: () => void;
}

const quotaConfig: Record<string, { icon: any; label: string; color: string }> = {
    AI_CALLS: { icon: Brain, label: 'AI调用', color: 'from-purple-500 to-indigo-500' },
    CALCULATIONS: { icon: BarChart3, label: '收益测算', color: 'from-green-500 to-emerald-500' },
    DIAGNOSES: { icon: Zap, label: '诊断分析', color: 'from-orange-500 to-yellow-500' },
    EXPORTS: { icon: FileText, label: '报告导出', color: 'from-blue-500 to-cyan-500' },
    PAPER_SEARCHES: { icon: Search, label: '论文搜索', color: 'from-pink-500 to-rose-500' },
    PAPER_SUMMARIES: { icon: BookOpen, label: 'AI摘要', color: 'from-violet-500 to-purple-500' },
    PROJECTS: { icon: Sparkles, label: '项目数量', color: 'from-teal-500 to-green-500' },
    API_CALLS: { icon: TrendingUp, label: 'API调用', color: 'from-gray-500 to-slate-500' },
};

export function QuotaPanel({ onUpgrade }: QuotaPanelProps) {
    const [quotas, setQuotas] = useState<QuotaUsage[]>([]);
    const [plan, setPlan] = useState<string>('FREE');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchQuotas();
    }, []);

    const fetchQuotas = async () => {
        try {
            const res = await fetch('/api/quota');
            if (res.ok) {
                const data = await res.json();
                setQuotas(data.quotas || []);
                setPlan(data.plan || 'FREE');
            }
        } catch (error) {
            console.error('Failed to fetch quotas:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatResetTime = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (3600 * 1000));

        if (diffHours < 1) {
            return '即将重置';
        } else if (diffHours < 24) {
            return `${diffHours}小时后重置`;
        } else {
            return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' 重置';
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    const exceededQuotas = quotas.filter(q => q.exceeded);
    const warningQuotas = quotas.filter(q => q.percentage >= 80 && !q.exceeded);

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* 头部 */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">使用额度</h3>
                        <p className="text-sm text-gray-500">当前套餐: {plan}</p>
                    </div>
                    {plan === 'FREE' && (
                        <Button onClick={onUpgrade} className="gap-1 bg-gradient-to-r from-primary-500 to-primary-600">
                            <Sparkles className="w-4 h-4" />
                            升级 Pro
                        </Button>
                    )}
                </div>
            </div>

            {/* 警告提示 */}
            {exceededQuotas.length > 0 && (
                <div className="px-6 py-3 bg-red-50 border-b border-red-100">
                    <div className="flex items-center gap-2 text-red-700">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">
                            {exceededQuotas.length} 项配额已用尽，部分功能受限
                        </span>
                    </div>
                </div>
            )}

            {/* 配额列表 */}
            <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {quotas.slice(0, 8).map((quota) => {
                        const config = quotaConfig[quota.type] || {
                            icon: Zap,
                            label: quota.type,
                            color: 'from-gray-500 to-gray-600',
                        };
                        const Icon = config.icon;

                        return (
                            <motion.div
                                key={quota.type}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`relative rounded-xl p-4 ${quota.exceeded
                                        ? 'bg-red-50 border border-red-200'
                                        : 'bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center`}>
                                        <Icon className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">{config.label}</span>
                                </div>

                                {quota.limit === -1 ? (
                                    <div className="text-xl font-bold text-gray-900">无限</div>
                                ) : (
                                    <>
                                        <div className="text-xl font-bold text-gray-900">
                                            {quota.remaining} <span className="text-sm font-normal text-gray-500">/ {quota.limit}</span>
                                        </div>

                                        {/* 进度条 */}
                                        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${quota.exceeded
                                                        ? 'bg-red-500'
                                                        : quota.percentage >= 80
                                                            ? 'bg-yellow-500'
                                                            : `bg-gradient-to-r ${config.color}`
                                                    }`}
                                                style={{ width: `${Math.min(100, quota.percentage)}%` }}
                                            />
                                        </div>

                                        {quota.resetsAt && (
                                            <div className="text-xs text-gray-400 mt-1">
                                                {formatResetTime(quota.resetsAt)}
                                            </div>
                                        )}
                                    </>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* 升级提示 */}
            {plan === 'FREE' && (
                <div className="px-6 py-4 bg-gradient-to-r from-primary-50 to-blue-50 border-t border-primary-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-primary-800">升级到 Pro 套餐</div>
                            <div className="text-xs text-primary-600">获得更多配额和高级功能</div>
                        </div>
                        <Link href="/pricing">
                            <Button variant="outline" size="sm" className="border-primary-300 text-primary-700 hover:bg-primary-100">
                                查看套餐
                            </Button>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

export default QuotaPanel;
