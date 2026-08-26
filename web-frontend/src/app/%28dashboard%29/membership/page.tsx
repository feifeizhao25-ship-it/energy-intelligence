'use client';

import React from 'react';
import { Plan, PLAN_DETAILS } from '@/lib/membership/plans';
import {
    Crown,
    Calendar,
    TrendingUp,
    FileText,
    Database,
    Zap,
    Award,
    CreditCard,
    Settings,
    HelpCircle,
} from 'lucide-react';

// Mock user data - 实际应该从API获取
const mockUser = {
    id: 'user_123',
    name: '张三',
    email: 'zhang@example.com',
    plan: Plan.FULL,
    planExpireAt: new Date('2027-01-06'),
    dailyAiCalls: 245,
    dailyResourceQueries: 38,
    dailyCalculations: 28,
    dailyDiagnoses: 15,
    paperCount: 156,
    projectCount: 45,
    stationCount: 8,
    folderCount: 12,
};

export default function MembershipCenterPage() {
    const daysLeft = Math.ceil(
        (new Date(mockUser.planExpireAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const planDetails = PLAN_DETAILS[mockUser.plan];

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2">会员中心</h1>
                    <p className="text-gray-400">管理您的会员权益和使用情况</p>
                </div>

                {/* Current Plan Card */}
                <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-8 mb-8 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="text-6xl">{planDetails.icon}</div>
                            <div>
                                <h2 className="text-3xl font-bold">{planDetails.name}会员</h2>
                                <p className="text-purple-100">
                                    到期时间：{mockUser.planExpireAt.toLocaleDateString('zh-CN')}
                                    （剩余{daysLeft}天）
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button className="bg-white/20 hover:bg-white/30 backdrop-blur px-6 py-3 rounded-lg font-semibold transition-all">
                                续费
                            </button>
                            <button className="bg-white text-purple-600 hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold transition-all">
                                升级团队版
                            </button>
                        </div>
                    </div>

                    {/* Benefits */}
                    <div className="grid grid-cols-4 gap-4">
                        <BenefitBadge icon={<Zap />} label="无水印报告" />
                        <BenefitBadge icon={<Crown />} label="优先响应" />
                        <BenefitBadge icon={<Database />} label="永久数据" />
                        <BenefitBadge icon={<Award />} label="全功能解锁" />
                    </div>
                </div>

                {/* Usage Statistics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div className="bg-gray-800 rounded-xl p-6">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <TrendingUp className="w-6 h-6 text-blue-500" />
                            本月使用统计
                        </h3>
                        <div className="space-y-4">
                            <UsageBar label="AI对话" current={245} max={300} color="blue" />
                            <UsageBar label="资源查询" current={38} max={-1} color="green" />
                            <UsageBar label="收益计算" current={28} max={-1} color="purple" />
                            <UsageBar label="运维诊断" current={15} max={-1} color="orange" />
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-6">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Database className="w-6 h-6 text-purple-500" />
                            存储空间
                        </h3>
                        <div className="space-y-4">
                            <StorageItem label="项目" current={45} max={200} icon="📊" />
                            <StorageItem label="文献" current={156} max={2000} icon="📚" />
                            <StorageItem label="电站" current={8} max={50} icon="⚡" />
                            <StorageItem label="文献夹" current={12} max={50} icon="📁" />
                        </div>
                    </div>
                </div>

                {/* Exclusive Benefits */}
                <div className="bg-gray-800 rounded-xl p-6 mb-8">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Award className="w-6 h-6 text-yellow-500" />
                        专属权益
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <BenefitCard icon="📄" title="无水印报告导出" />
                        <BenefitCard icon="⚡" title="优先响应" />
                        <BenefitCard icon="💾" title="历史数据永久保存" />
                        <BenefitCard icon="🛠️" title="20个工具全解锁" />
                    </div>
                </div>

                {/* Order History */}
                <div className="bg-gray-800 rounded-xl p-6 mb-8">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-green-500" />
                        订单记录
                    </h3>
                    <div className="space-y-3">
                        <OrderItem
                            date="2026-01-06"
                            type="全能版年付"
                            amount={3980}
                            status="已支付"
                        />
                        <OrderItem
                            date="2025-01-06"
                            type="专业版年付"
                            amount={1980}
                            status="已支付"
                        />
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ActionCard
                        icon={<CreditCard className="w-8 h-8" />}
                        title="支付方式"
                        description="管理支付方式和发票"
                        action="管理"
                    />
                    <ActionCard
                        icon={<Settings className="w-8 h-8" />}
                        title="账户设置"
                        description="修改个人信息和偏好"
                        action="设置"
                    />
                    <ActionCard
                        icon={<HelpCircle className="w-8 h-8" />}
                        title="帮助中心"
                        description="查看使用指南和常见问题"
                        action="查看"
                    />
                </div>
            </div>
        </div>
    );
}

function BenefitBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-2 flex items-center gap-2">
            <div className="text-white/90">{icon}</div>
            <span className="text-sm font-medium">{label}</span>
        </div>
    );
}

function UsageBar({
    label,
    current,
    max,
    color,
}: {
    label: string;
    current: number;
    max: number;
    color: string;
}) {
    const percentage = max === -1 ? 100 : Math.min((current / max) * 100, 100);
    const isUnlimited = max === -1;

    const colorMap: Record<string, string> = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        purple: 'bg-purple-500',
        orange: 'bg-orange-500',
    };

    return (
        <div>
            <div className="flex justify-between mb-1 text-sm">
                <span className="text-gray-300">{label}</span>
                <span className="text-gray-400">
                    {current}{isUnlimited ? '' : `/${max}`}次
                </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                    className={`${colorMap[color]} h-2 rounded-full transition-all`}
                    style={{ width: `${isUnlimited ? 100 : percentage}%` }}
                />
            </div>
        </div>
    );
}

function StorageItem({
    label,
    current,
    max,
    icon,
}: {
    label: string;
    current: number;
    max: number;
    icon: string;
}) {
    const percentage = Math.min((current / max) * 100, 100);

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <div>
                    <div className="font-medium">{label}</div>
                    <div className="text-sm text-gray-400">
                        {current}/{max}个
                    </div>
                </div>
            </div>
            <div className="w-32">
                <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                        className="bg-purple-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

function BenefitCard({ icon, title }: { icon: string; title: string }) {
    return (
        <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-3xl mb-2">{icon}</div>
            <div className="text-sm text-gray-300">{title}</div>
        </div>
    );
}

function OrderItem({
    date,
    type,
    amount,
    status,
}: {
    date: string;
    type: string;
    amount: number;
    status: string;
}) {
    return (
        <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
            <div className="flex items-center gap-4">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                    <div className="font-medium">{type}</div>
                    <div className="text-sm text-gray-400">{date}</div>
                </div>
            </div>
            <div className="text-right">
                <div className="font-bold">¥{amount.toLocaleString()}</div>
                <div className="text-sm text-green-500">{status}</div>
            </div>
            <div className="flex gap-2">
                <button className="text-blue-400 hover:text-blue-300 text-sm">查看</button>
                <button className="text-blue-400 hover:text-blue-300 text-sm">发票</button>
            </div>
        </div>
    );
}

function ActionCard({
    icon,
    title,
    description,
    action,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    action: string;
}) {
    return (
        <div className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition-colors cursor-pointer">
            <div className="text-blue-500 mb-3">{icon}</div>
            <h4 className="font-bold mb-2">{title}</h4>
            <p className="text-sm text-gray-400 mb-4">{description}</p>
            <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                {action} →
            </button>
        </div>
    );
}
