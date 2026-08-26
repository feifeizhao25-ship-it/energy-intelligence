'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircle, AlertTriangle, XCircle, Info,
    TrendingUp, TrendingDown, Minus,
    Download, FileText, Share2, Copy,
    Shield, Clock, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 结论卡片组件
 * 护城河：统一可交付输出
 */

interface ConclusionCardProps {
    type: string;
    title: string;
    headline: string;
    summary: string;
    keyMetrics: Array<{
        name: string;
        value: number | string;
        unit?: string;
        trend?: 'UP' | 'DOWN' | 'STABLE';
        benchmark?: string;
    }>;
    recommendation: {
        level: 'HIGHLY_RECOMMENDED' | 'RECOMMENDED' | 'NEUTRAL' | 'CAUTION' | 'NOT_RECOMMENDED';
        reason: string;
        confidence: number;
    };
    risks?: Array<{
        level: string;
        message: string;
    }>;
    nextSteps?: Array<{
        priority: number;
        action: string;
        description: string;
        link?: string;
        requiresPro?: boolean;
    }>;
    audit: {
        auditId: string;
        calcVersion: string;
        computedAt: string;
        reproducible: boolean;
    };
    onExport?: (format: 'PDF' | 'EXCEL' | 'WORD') => void;
    onShare?: () => void;
    onViewAudit?: (auditId: string) => void;
}

export function ConclusionCard({
    title,
    headline,
    summary,
    keyMetrics,
    recommendation,
    risks = [],
    nextSteps = [],
    audit,
    onExport,
    onShare,
    onViewAudit,
}: ConclusionCardProps) {
    const levelConfig = {
        HIGHLY_RECOMMENDED: { color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle, label: '强烈推荐' },
        RECOMMENDED: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle, label: '推荐' },
        NEUTRAL: { color: 'text-gray-600', bg: 'bg-gray-50', icon: Info, label: '中性' },
        CAUTION: { color: 'text-yellow-600', bg: 'bg-yellow-50', icon: AlertTriangle, label: '谨慎' },
        NOT_RECOMMENDED: { color: 'text-red-600', bg: 'bg-red-50', icon: XCircle, label: '不推荐' },
    };

    const config = levelConfig[recommendation.level];
    const Icon = config.icon;

    const trendIcons = {
        UP: <TrendingUp className="w-4 h-4 text-green-500" />,
        DOWN: <TrendingDown className="w-4 h-4 text-red-500" />,
        STABLE: <Minus className="w-4 h-4 text-gray-400" />,
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
            {/* 头部 - 投资评级 */}
            <div className={`${config.bg} px-6 py-4 border-b border-gray-100`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Icon className={`w-6 h-6 ${config.color}`} />
                        <div>
                            <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                            <div className="text-xs text-gray-500">
                                置信度: {Math.round(recommendation.confidence * 100)}%
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500">v{audit.calcVersion}</span>
                    </div>
                </div>
            </div>

            {/* 主体 */}
            <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-lg text-gray-700 mb-4">{headline}</p>
                <p className="text-gray-600 text-sm mb-6">{summary}</p>

                {/* 核心指标 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {keyMetrics.map((metric, index) => (
                        <div key={index} className="bg-gray-50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-500">{metric.name}</span>
                                {metric.trend && trendIcons[metric.trend]}
                            </div>
                            <div className="text-xl font-bold text-gray-900">
                                {typeof metric.value === 'number'
                                    ? metric.value.toLocaleString()
                                    : metric.value}
                                {metric.unit && <span className="text-sm font-normal text-gray-500 ml-1">{metric.unit}</span>}
                            </div>
                            {metric.benchmark && (
                                <div className="text-xs text-gray-400 mt-1">基准: {metric.benchmark}</div>
                            )}
                        </div>
                    ))}
                </div>

                {/* 推荐理由 */}
                <div className="bg-blue-50 rounded-xl p-4 mb-6">
                    <div className="text-sm font-medium text-blue-800 mb-1">投资建议</div>
                    <div className="text-blue-700">{recommendation.reason}</div>
                </div>

                {/* 风险提示 */}
                {risks.length > 0 && (
                    <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            风险提示
                        </h4>
                        <div className="space-y-2">
                            {risks.map((risk, index) => (
                                <div
                                    key={index}
                                    className={`text-sm px-3 py-2 rounded-lg ${risk.level === 'CRITICAL' ? 'bg-red-50 text-red-700' :
                                            risk.level === 'WARNING' ? 'bg-yellow-50 text-yellow-700' :
                                                'bg-gray-50 text-gray-700'
                                        }`}
                                >
                                    [{risk.level}] {risk.message}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 下一步建议 */}
                {nextSteps.length > 0 && (
                    <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">建议下一步</h4>
                        <div className="space-y-2">
                            {nextSteps.slice(0, 3).map((step, index) => (
                                <div
                                    key={index}
                                    className="flex items-start gap-3 text-sm bg-gray-50 p-3 rounded-lg"
                                >
                                    <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">
                                        {step.priority}
                                    </span>
                                    <div>
                                        <div className="font-medium text-gray-900">{step.action}</div>
                                        <div className="text-gray-600">{step.description}</div>
                                        {step.requiresPro && (
                                            <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                                                Pro 功能
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 底部操作栏 */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                    {/* 审计信息 */}
                    <button
                        onClick={() => onViewAudit?.(audit.auditId)}
                        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
                    >
                        <Database className="w-4 h-4" />
                        <span>审计ID: {audit.auditId.slice(0, 12)}...</span>
                        {audit.reproducible && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-600 rounded text-xs">
                                可复现
                            </span>
                        )}
                    </button>

                    {/* 导出按钮 */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onExport?.('PDF')}
                            className="gap-1"
                        >
                            <FileText className="w-4 h-4" />
                            PDF
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onExport?.('EXCEL')}
                            className="gap-1"
                        >
                            <Download className="w-4 h-4" />
                            Excel
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onShare}
                            className="gap-1"
                        >
                            <Share2 className="w-4 h-4" />
                            分享
                        </Button>
                    </div>
                </div>

                {/* 时间戳 */}
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                    <Clock className="w-3 h-3" />
                    <span>生成于 {new Date(audit.computedAt).toLocaleString('zh-CN')}</span>
                </div>
            </div>
        </motion.div>
    );
}

export default ConclusionCard;
