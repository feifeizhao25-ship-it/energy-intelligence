'use client';

import React from 'react';
import { Plan, PLAN_DETAILS } from '@/lib/membership/plans';
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
    const features = {
        FREE: {
            included: [
                '资源地图查看',
                '单点查询 3次/天',
                '光伏计算 3次/天',
                '论文搜索 5次/天',
                'AI对话 5次/天',
                '免费PDF下载',
            ],
            excluded: [
                '月度/历史数据',
                '运维诊断',
                '报告导出',
                '文献库管理',
            ],
        },
        PRO: {
            included: [
                '✅ 资源查询无限次',
                '✅ 月度数据 + 34年历史趋势',
                '✅ 多点对比（3点）',
                '✅ 光伏/风电计算无限次',
                '✅ 25年现金流分析',
                '✅ 敏感性分析',
                '✅ 论文搜索无限次',
                '✅ AI中文摘要',
                '✅ 引用网络 + 推荐',
                '✅ 文献库 500篇',
                '✅ AI对话 100次/天',
                '✅ 报告导出（PDF/Word）',
            ],
            excluded: ['运维诊断功能'],
        },
        MAINTENANCE: {
            included: [
                '✅ 资源查询无限次',
                '✅ 光伏计算 10次/天',
                '✅ 论文搜索 10次/天',
                '✅ AI对话 100次/天',
                '',
                '🔧 运维专属功能：',
                '✅ PR深度分析（无限）',
                '✅ 智能清洗决策',
                '✅ 逆变器故障诊断（无限）',
                '✅ 组串异常定位',
                '✅ IV曲线分析',
                '✅ 检修工作票生成',
                '✅ 预测性维护计划',
                '✅ 停机损失计算',
                '✅ 风机故障诊断',
                '✅ 电站管理 10个',
            ],
            excluded: [],
        },
        FULL: {
            included: [
                '✅ 专业版全部功能',
                '✅ 运维版全部功能',
                '',
                '💎 全能专属：',
                '✅ 多点对比 10点',
                '✅ 详细版报告（无水印）',
                '✅ 电站管理 50个',
                '✅ 文献库 2000篇',
                '✅ AI对话 300次/天',
                '✅ 优先响应',
                '✅ 永久保存所有数据',
            ],
            excluded: [],
        },
        TEAM: {
            included: [
                '✅ 全能版全部功能 × 5人',
                '',
                '👥 团队专属：',
                '✅ 5个独立账号',
                '✅ 项目共享协作',
                '✅ 统一账单管理',
                '✅ 成员权限管理',
                '✅ 团队数据统计',
                '✅ 电站管理 100个',
                '✅ 文献库 5000篇（共享）',
                '✅ AI对话 500次/天（共享）',
            ],
            excluded: [],
        },
        ENTERPRISE: {
            included: [
                '✅ 全部功能无限制',
                '✅ 无限账号',
                '✅ 无限电站管理',
                '✅ 无限AI对话',
                '✅ 无限存储空间',
                '',
                '🏢 企业专属：',
                '✅ API接入（集成到自有系统）',
                '✅ 白标报告（使用企业Logo）',
                '✅ SSO单点登录',
                '✅ 专属客户成功经理',
                '✅ 优先技术支持',
                '✅ 季度业务回顾',
                '✅ 定制开发配额',
            ],
            excluded: [],
        },
    };

    return features[plan];
}
