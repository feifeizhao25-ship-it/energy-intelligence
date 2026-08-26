'use client';

import { motion } from 'framer-motion';
import { Users, Calculator, Star, DollarSign, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatItem {
    value: string;
    label: string;
    icon: React.ReactNode;
}

const defaultStats: StatItem[] = [
    { value: '50万+', label: '次测算', icon: <Calculator className="w-4 h-4" /> },
    { value: '12万+', label: '用户', icon: <Users className="w-4 h-4" /> },
    { value: '98%', label: '满意度', icon: <Star className="w-4 h-4" /> },
    { value: '¥28亿', label: '评估资产', icon: <DollarSign className="w-4 h-4" /> },
];

interface SocialProofProps {
    stats?: StatItem[];
    variant?: 'horizontal' | 'vertical';
    className?: string;
}

/**
 * SocialProof 组件
 * 社会证明展示，增强用户信任度
 */
export function SocialProof({
    stats = defaultStats,
    variant = 'horizontal',
    className
}: SocialProofProps) {
    return (
        <motion.div
            className={cn(
                'bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-4',
                className
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
        >
            <div className={cn(
                'flex items-center justify-center gap-6 md:gap-10',
                variant === 'vertical' && 'flex-col gap-4'
            )}>
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        className="text-center"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                    >
                        <div className="flex items-center justify-center gap-1 text-primary-500 mb-1">
                            {stat.icon}
                        </div>
                        <div className="text-xl md:text-2xl font-bold text-gray-900 font-display">
                            {stat.value}
                        </div>
                        <div className="text-xs md:text-sm text-gray-500">{stat.label}</div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}

/**
 * SocialProofBar 组件
 * 简化的社会证明条
 */
export function SocialProofBar({ className }: { className?: string }) {
    return (
        <div className={cn(
            'flex flex-wrap items-center justify-center gap-6 md:gap-10',
            className
        )}>
            {defaultStats.map((stat) => (
                <div key={stat.label} className="text-center">
                    <div className="text-xl md:text-2xl font-bold text-gray-900 font-display">
                        {stat.value}
                    </div>
                    <div className="text-xs md:text-sm text-gray-500">{stat.label}</div>
                </div>
            ))}
        </div>
    );
}

/**
 * TrustBadges 组件
 * 信任徽章展示
 */
export function TrustBadges({ className }: { className?: string }) {
    const badges = [
        { icon: '🔒', text: '数据加密' },
        { icon: '📊', text: 'NASA数据' },
        { icon: '⚡', text: '实时计算' },
        { icon: '🏆', text: '专业可靠' },
    ];

    return (
        <div className={cn('flex flex-wrap items-center justify-center gap-4', className)}>
            {badges.map((badge) => (
                <div
                    key={badge.text}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full text-sm text-gray-600"
                >
                    <span>{badge.icon}</span>
                    <span>{badge.text}</span>
                </div>
            ))}
        </div>
    );
}

/**
 * RealtimeCounter 组件
 * 实时计数动画
 */
export function RealtimeCounter({ className }: { className?: string }) {
    return (
        <motion.div
            className={cn(
                'inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm',
                className
            )}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
        >
            <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div
                        key={i}
                        className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                    >
                        {String.fromCharCode(65 + i - 1)}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600">
                <TrendingUp className="w-3 h-3 text-primary-500" />
                <span className="font-semibold text-primary-600">12,847</span>
                <span>人已完成测算</span>
            </div>
        </motion.div>
    );
}
