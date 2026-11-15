'use client';

import React from 'react';
import { Plan, PLAN_DETAILS } from '@/lib/membership/plans';
import registry from '@/lib/entitlements/entitlements.json';
import { Check, X } from 'lucide-react';

interface PricingCardProps {
    plan: Plan;
    billingPeriod: 'monthly' | 'yearly';
    onSelect: (plan: Plan) => void;
}

export default function PricingCard({ plan, billingPeriod, onSelect }: PricingCardProps) {
    const details = PLAN_DETAILS[plan] as any;
    const price = billingPeriod === 'monthly' ? details.monthlyPrice : details.yearlyPrice;
    const dailyCost = billingPeriod === 'yearly' ? (price / 365).toFixed(1) : (price / 30).toFixed(1);

    // 功能列表
    const features = getFeaturesByPlan(plan);

    return (
        <div
            className={`relative bg-gray-800 border ${details.recommended
                ? 'border-purple-500 shadow-xl shadow-purple-500/20 scale-105'
                : details.popular
                    ? 'border-blue-500 shadow-lg shadow-blue-500/10'
                    : 'border-gray-700'
                } rounded-xl p-6 hover:scale-105 transition-transform duration-300`}
        >
            {/* 推荐标签 */}
            {details.recommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold px-4 py-1 rounded-full shadow-lg">
                        最超值
                    </span>
                </div>
            )}
            {details.popular && !details.recommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-bold px-4 py-1 rounded-full shadow-lg">
                        热门推荐
                    </span>
                </div>
            )}

            {/* 图标和标题 */}
            <div className="text-center mb-6">
                <div className="text-5xl mb-3">{details.icon}</div>
                <h3 className="text-2xl font-bold text-white mb-2">{details.name}</h3>
                <p className="text-gray-400 text-sm">{details.description}</p>
            </div>

            {/* 价格 */}
            <div className="text-center mb-6">
                {price === 0 ? (
                    <div className="text-4xl font-bold text-white">免费</div>
                ) : (
                    <>
                        <div className="text-4xl font-bold text-white mb-1">
                            ¥{price.toLocaleString()}
                            <span className="text-lg text-gray-400 font-normal">
                                /{billingPeriod === 'monthly' ? '月' : '年'}
                            </span>
                        </div>
                        <div className="text-sm text-gray-400">日均 ¥{dailyCost}</div>
                    </>
                )}
            </div>

            {/* 功能列表 */}
            <div className="space-y-3 mb-6">
                {features.included.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-300">{feature}</span>
                    </div>
                ))}
                {features.excluded.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 opacity-50">
                        <X className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-500">{feature}</span>
                    </div>
                ))}
            </div>

            {/* 选择按钮 */}
            <button
                onClick={() => onSelect(plan)}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${details.recommended
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg'
                    : details.popular
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white'
                        : price === 0
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
            >
                {price === 0 ? '免费注册' : plan === 'ENTERPRISE' ? '联系销售' : '立即开通'}
            </button>
        </div>
    );
}

function getFeaturesByPlan(plan: Plan): { included: string[]; excluded: string[] } {
    const key = { FREE: 'free', PRO: 'pro', MAINTENANCE: 'maintenance', FULL: 'full', TEAM: 'team', ENTERPRISE: 'enterprise' }[plan];
    const tier = (registry.tiers as Record<string, { features_zh?: string[] }>)[key];
    return { included: (tier?.features_zh ?? []).map((line) => line.startsWith('✅') ? line : `✅ ${line}`), excluded: [] };
}
