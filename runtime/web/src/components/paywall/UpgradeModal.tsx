'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, Crown, Sparkles, Check, Zap, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PLAN_DETAILS, ANNUAL_DISCOUNT, getAnnualPrice, Plan } from '@/lib/membership/plans';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    trigger?: 'limit_reached' | 'premium_feature' | 'manual';
    blockedFeature?: string;
    currentPlan?: Plan;
}

const UPGRADE_BENEFITS = {
    PRO: [
        '每日100次AI对话',
        '无限资源查询与收益计算',
        '无限文献搜索与AI摘要',
        '最多3点资源对比',
        'PDF/Word报告导出',
    ],
    FULL: [
        '每日300次AI对话',
        '全部运维诊断工具',
        'DeepSeek-V3 顶级AI模型',
        '最多10点资源对比',
        '无水印报告导出',
        '优先客服响应',
    ],
};

export default function UpgradeModal({
    isOpen,
    onClose,
    trigger = 'manual',
    blockedFeature,
    currentPlan = Plan.FREE,
}: UpgradeModalProps) {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

    const getModalTitle = () => {
        switch (trigger) {
            case 'limit_reached':
                return '今日额度已用完';
            case 'premium_feature':
                return '此功能需要升级会员';
            default:
                return '解锁全部专业功能';
        }
    };

    const getModalSubtitle = () => {
        if (blockedFeature) {
            return `升级后即可无限使用「${blockedFeature}」功能`;
        }
        switch (trigger) {
            case 'limit_reached':
                return '升级会员，享受无限制使用体验';
            default:
                return '新能源行业专业人士的效率神器';
        }
    };

    const proMonthly = PLAN_DETAILS.PRO.monthlyPrice;
    const proYearly = getAnnualPrice(Plan.PRO);
    const fullMonthly = PLAN_DETAILS.FULL.monthlyPrice;
    const fullYearly = getAnnualPrice(Plan.FULL);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden"
                    >
                        {/* Header */}
                        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white">
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-white/20 rounded-xl">
                                    <Crown className="w-6 h-6" />
                                </div>
                                <h2 className="text-2xl font-bold">{getModalTitle()}</h2>
                            </div>
                            <p className="text-blue-100">{getModalSubtitle()}</p>
                        </div>

                        {/* Billing Toggle */}
                        <div className="flex justify-center py-6 border-b border-slate-100">
                            <div className="bg-slate-100 p-1 rounded-xl flex">
                                <button
                                    onClick={() => setBillingCycle('monthly')}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${billingCycle === 'monthly'
                                            ? 'bg-white text-slate-900 shadow'
                                            : 'text-slate-500'
                                        }`}
                                >
                                    月付
                                </button>
                                <button
                                    onClick={() => setBillingCycle('yearly')}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${billingCycle === 'yearly'
                                            ? 'bg-white text-slate-900 shadow'
                                            : 'text-slate-500'
                                        }`}
                                >
                                    年付
                                    <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                                        {ANNUAL_DISCOUNT.discountLabel}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Plans */}
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* PRO Plan */}
                            <div className="border border-slate-200 rounded-2xl p-6 hover:border-blue-300 hover:shadow-lg transition-all">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-2xl">⭐</span>
                                    <div>
                                        <h3 className="font-bold text-slate-900">专业版</h3>
                                        <p className="text-xs text-slate-500">资源+计算+文献</p>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <span className="text-3xl font-black text-slate-900">
                                        ¥{billingCycle === 'yearly' ? Math.round(proYearly / 12) : proMonthly}
                                    </span>
                                    <span className="text-slate-400 text-sm">/月</span>
                                    {billingCycle === 'yearly' && (
                                        <div className="text-xs text-slate-400 mt-1">
                                            年付 ¥{proYearly} (相当于{ANNUAL_DISCOUNT.monthsEquivalent}个月)
                                        </div>
                                    )}
                                </div>

                                <ul className="space-y-2 mb-6">
                                    {UPGRADE_BENEFITS.PRO.map((benefit, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                                            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                            {benefit}
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href={`/checkout?plan=PRO&cycle=${billingCycle}`}
                                    className="block w-full bg-slate-900 text-white text-center py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors"
                                >
                                    升级专业版
                                </Link>
                            </div>

                            {/* FULL Plan - Recommended */}
                            <div className="relative border-2 border-blue-500 rounded-2xl p-6 bg-blue-50/30 shadow-lg">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" /> 推荐
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-2xl">💎</span>
                                    <div>
                                        <h3 className="font-bold text-slate-900">全能版</h3>
                                        <p className="text-xs text-slate-500">全部功能无限制</p>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <span className="text-3xl font-black text-blue-600">
                                        ¥{billingCycle === 'yearly' ? Math.round(fullYearly / 12) : fullMonthly}
                                    </span>
                                    <span className="text-slate-400 text-sm">/月</span>
                                    {billingCycle === 'yearly' && (
                                        <div className="text-xs text-slate-400 mt-1">
                                            年付 ¥{fullYearly} (相当于{ANNUAL_DISCOUNT.monthsEquivalent}个月)
                                        </div>
                                    )}
                                </div>

                                <ul className="space-y-2 mb-6">
                                    {UPGRADE_BENEFITS.FULL.map((benefit, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                                            <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                            {benefit}
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href={`/checkout?plan=FULL&cycle=${billingCycle}`}
                                    className="block w-full bg-blue-600 text-white text-center py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    升级全能版 <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-6 text-center">
                            <p className="text-xs text-slate-400">
                                支付方式、续费与退款条件以下单确认页为准 ·
                                <Link href="/pricing" className="text-blue-600 hover:underline">
                                    查看完整对比
                                </Link>
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
