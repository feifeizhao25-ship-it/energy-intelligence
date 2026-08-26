'use client';

import React from 'react';
import { X, AlertTriangle, Zap, TrendingUp } from 'lucide-react';
import { Plan, PLAN_DETAILS } from '@/lib/membership/plans';

interface UsageLimitModalProps {
    isOpen: boolean;
    onClose: () => void;
    feature: string;
    currentPlan: Plan;
    limit: number;
    suggestedPlans?: Plan[];
}

export default function UsageLimitModal({
    isOpen,
    onClose,
    feature,
    currentPlan,
    limit,
    suggestedPlans = [Plan.PRO, Plan.FULL],
}: UsageLimitModalProps) {
    if (!isOpen) return null;

    const featureNames: Record<string, string> = {
        ai_chat: 'AI对话',
        resource_query: '资源查询',
        calculation: '收益计算',
        paper_search: '文献搜索',
        diagnosis: '运维诊断',
    };

    const featureName = featureNames[feature] || feature;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-2xl max-w-2xl w-full mx-4 shadow-2xl border border-gray-700">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">使用次数已达上限</h2>
                            <p className="text-gray-400 text-sm">升级会员以解锁更多使用次数</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Current Status */}
                    <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400">当前等级</span>
                            <span className="text-white font-semibold">
                                {PLAN_DETAILS[currentPlan].name}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400">{featureName}限额</span>
                            <span className="text-orange-500 font-bold">
                                {limit === -1 ? '无限' : `${limit}次/天`}
                            </span>
                        </div>
                    </div>

                    {/* Suggested Plans */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-500" />
                            推荐升级方案
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {suggestedPlans.map((plan) => (
                                <UpgradePlanCard key={plan} plan={plan} currentPlan={currentPlan} />
                            ))}
                        </div>
                    </div>

                    {/* Benefits */}
                    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/20">
                        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-400" />
                            升级后您将获得
                        </h4>
                        <ul className="space-y-2 text-sm text-gray-300">
                            <li className="flex items-center gap-2">
                                <span className="text-green-500">✓</span>
                                更高的{featureName}使用限额
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-green-500">✓</span>
                                解锁更多高级功能
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-green-500">✓</span>
                                优先技术支持
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-green-500">✓</span>
                                永久保存历史数据
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-700 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                    >
                        稍后再说
                    </button>
                    <button
                        onClick={() => (window.location.href = '/pricing')}
                        className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-semibold transition-all shadow-lg"
                    >
                        立即升级
                    </button>
                </div>
            </div>
        </div>
    );
}

function UpgradePlanCard({ plan, currentPlan }: { plan: Plan; currentPlan: Plan }) {
    const details = PLAN_DETAILS[plan];
    const isRecommended = 'recommended' in details && details.recommended;

    return (
        <div
            className={`relative bg-gray-700 rounded-xl p-4 border ${isRecommended ? 'border-purple-500 shadow-lg shadow-purple-500/20' : 'border-gray-600'
                }`}
        >
            {isRecommended && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        推荐
                    </span>
                </div>
            )}
            <div className="text-center mb-3">
                <div className="text-3xl mb-2">{details.icon}</div>
                <h4 className="font-bold text-white">{details.name}</h4>
                <p className="text-sm text-gray-400 mb-2">{details.description}</p>
                <div className="text-2xl font-bold text-white">
                    ¥{details.yearlyPrice.toLocaleString()}
                    <span className="text-sm text-gray-400 font-normal">/年</span>
                </div>
            </div>
            <button
                onClick={() => (window.location.href = `/pricing?recommended=${plan}`)}
                className={`w-full py-2 rounded-lg font-semibold transition-all ${isRecommended
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white'
                    : 'bg-gray-600 hover:bg-gray-500 text-white'
                    }`}
            >
                立即升级
            </button>
        </div>
    );
}
