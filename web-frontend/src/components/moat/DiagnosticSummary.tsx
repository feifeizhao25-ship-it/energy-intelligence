'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircle, AlertTriangle, XCircle, AlertOctagon, HelpCircle,
    Zap, Clock, DollarSign, Wrench, FileText, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 诊断摘要组件
 * 护城河：统一诊断输出格式
 */

interface DiagnosticSummaryProps {
    type: string;
    status: 'HEALTHY' | 'WARNING' | 'ABNORMAL' | 'CRITICAL' | 'UNKNOWN';
    confidence: number;
    headline: string;
    analysis: string;
    findings: Array<{
        severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        issue: string;
        evidence: string[];
        probability?: number;
    }>;
    prioritizedActions: Array<{
        priority: 1 | 2 | 3 | 4 | 5;
        action: string;
        description: string;
        urgency: 'IMMEDIATE' | '24H' | '7D' | '30D' | 'SCHEDULED';
        estimatedCost?: number;
        estimatedBenefit?: number;
        requiresWorkPermit?: boolean;
        requiresShutdown?: boolean;
    }>;
    lossEstimate?: {
        dailyLoss: number;
        monthlyLoss: number;
        unit: string;
    };
    benchmark?: {
        name: string;
        value: number;
        actualValue: number;
        gap: number;
        gapPercentage: number;
    };
    audit: {
        auditId: string;
        calcVersion: string;
        computedAt: string;
    };
    onTakeAction?: (action: string) => void;
    onViewEvidence?: (finding: any) => void;
    onGenerateWorkOrder?: () => void;
}

const statusConfig = {
    HEALTHY: { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle, label: '健康' },
    WARNING: { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: AlertTriangle, label: '警告' },
    ABNORMAL: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: AlertOctagon, label: '异常' },
    CRITICAL: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle, label: '严重' },
    UNKNOWN: { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', icon: HelpCircle, label: '未知' },
};

const urgencyConfig = {
    IMMEDIATE: { color: 'bg-red-100 text-red-700', label: '立即' },
    '24H': { color: 'bg-orange-100 text-orange-700', label: '24小时内' },
    '7D': { color: 'bg-yellow-100 text-yellow-700', label: '7天内' },
    '30D': { color: 'bg-blue-100 text-blue-700', label: '30天内' },
    SCHEDULED: { color: 'bg-gray-100 text-gray-700', label: '计划安排' },
};

const severityColors = {
    INFO: 'bg-gray-100 text-gray-600',
    LOW: 'bg-blue-100 text-blue-600',
    MEDIUM: 'bg-yellow-100 text-yellow-600',
    HIGH: 'bg-orange-100 text-orange-600',
    CRITICAL: 'bg-red-100 text-red-600',
};

export function DiagnosticSummary({
    status,
    confidence,
    headline,
    analysis,
    findings,
    prioritizedActions,
    lossEstimate,
    benchmark,
    audit,
    onTakeAction,
    onViewEvidence,
    onGenerateWorkOrder,
}: DiagnosticSummaryProps) {
    const config = statusConfig[status];
    const StatusIcon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
            {/* 状态头部 */}
            <div className={`${config.bg} ${config.border} border-b px-6 py-4`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <StatusIcon className={`w-8 h-8 ${config.color}`} />
                        <div>
                            <div className={`text-lg font-bold ${config.color}`}>{config.label}</div>
                            <div className="text-xs text-gray-500">
                                诊断置信度: {Math.round(confidence * 100)}%
                            </div>
                        </div>
                    </div>
                    {lossEstimate && (
                        <div className="text-right">
                            <div className="text-xs text-gray-500">预估月损失</div>
                            <div className="text-xl font-bold text-red-600">
                                ¥{lossEstimate.monthlyLoss.toLocaleString()}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 诊断结论 */}
            <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{headline}</h3>
                <p className="text-gray-600 mb-6">{analysis}</p>

                {/* 基准对比 */}
                {benchmark && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{benchmark.name}</span>
                            <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <div className="text-xs text-gray-500">实际值</div>
                                    <div className="text-lg font-bold text-gray-900">
                                        {(benchmark.actualValue * 100).toFixed(1)}%
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs text-gray-500">基准值</div>
                                    <div className="text-lg font-bold text-green-600">
                                        {(benchmark.value * 100).toFixed(1)}%
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs text-gray-500">差距</div>
                                    <div className={`text-lg font-bold ${benchmark.gap < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {benchmark.gapPercentage > 0 ? '+' : ''}{benchmark.gapPercentage.toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 问题发现 */}
                {findings.length > 0 && (
                    <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            问题发现 ({findings.length})
                        </h4>
                        <div className="space-y-2">
                            {findings.map((finding, index) => (
                                <div
                                    key={index}
                                    className="bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => onViewEvidence?.(finding)}
                                >
                                    <div className="flex items-start gap-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[finding.severity]}`}>
                                            {finding.severity}
                                        </span>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900">{finding.issue}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                证据: {finding.evidence.slice(0, 2).join(' / ')}
                                                {finding.evidence.length > 2 && ` +${finding.evidence.length - 2}项`}
                                            </div>
                                            {finding.probability !== undefined && (
                                                <div className="text-xs text-gray-400 mt-1">
                                                    诊断概率: {Math.round(finding.probability * 100)}%
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 优先级动作 */}
                <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        建议措施（按优先级）
                    </h4>
                    <div className="space-y-3">
                        {prioritizedActions.map((action, index) => (
                            <div
                                key={index}
                                className="border border-gray-200 rounded-xl p-4 hover:border-primary-200 transition-colors"
                            >
                                <div className="flex items-start gap-3">
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${action.priority === 1 ? 'bg-red-100 text-red-600' :
                                            action.priority === 2 ? 'bg-orange-100 text-orange-600' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        {action.priority}
                                    </span>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-900">{action.action}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs ${urgencyConfig[action.urgency].color}`}>
                                                {urgencyConfig[action.urgency].label}
                                            </span>
                                            {action.requiresWorkPermit && (
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                                    需工作票
                                                </span>
                                            )}
                                            {action.requiresShutdown && (
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                                    需停机
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{action.description}</p>
                                        {(action.estimatedCost || action.estimatedBenefit) && (
                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                {action.estimatedCost && (
                                                    <span className="flex items-center gap-1">
                                                        <DollarSign className="w-3 h-3" />
                                                        预估成本: ¥{action.estimatedCost.toLocaleString()}
                                                    </span>
                                                )}
                                                {action.estimatedBenefit && (
                                                    <span className="flex items-center gap-1 text-green-600">
                                                        <DollarSign className="w-3 h-3" />
                                                        预估收益: ¥{action.estimatedBenefit.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        size="sm"
                                        variant={action.priority === 1 ? 'default' : 'outline'}
                                        onClick={() => onTakeAction?.(action.action)}
                                    >
                                        执行
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 底部操作栏 */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Shield className="w-4 h-4" />
                        <span>审计ID: {audit.auditId.slice(0, 12)}...</span>
                        <span>|</span>
                        <span>v{audit.calcVersion}</span>
                        <span>|</span>
                        <Clock className="w-3 h-3" />
                        <span>{new Date(audit.computedAt).toLocaleString('zh-CN')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onGenerateWorkOrder}
                            className="gap-1"
                        >
                            <Wrench className="w-4 h-4" />
                            生成工作票
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                        >
                            <FileText className="w-4 h-4" />
                            导出报告
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default DiagnosticSummary;
