'use client';

import React from 'react';
import { Crown, AlertCircle } from 'lucide-react';
import { Plan, PLAN_DETAILS } from '@/lib/membership/plans';

interface MembershipBadgeProps {
    plan: Plan;
    daysLeft?: number;
    compact?: boolean;
}

export default function MembershipBadge({ plan, daysLeft, compact = false }: MembershipBadgeProps) {
    const details = PLAN_DETAILS[plan];

    if (plan === Plan.FREE) {
        return null; // 免费用户不显示徽章
    }

    const isExpiringSoon = daysLeft !== undefined && daysLeft <= 7;
    const isExpired = daysLeft !== undefined && daysLeft < 0;

    if (compact) {
        return (
            <div
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${isExpired
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : isExpiringSoon
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : `bg-${details.color}-500/20 text-${details.color}-400 border border-${details.color}-500/30`
                    }`}
            >
                <Crown className="w-3 h-3" />
                {details.name}
            </div>
        );
    }

    return (
        <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${isExpired
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : isExpiringSoon
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : `bg-gradient-to-r from-${details.color}-600 to-${details.color}-400 text-white shadow-lg`
                }`}
        >
            <Crown className="w-5 h-5" />
            <div>
                <div className="text-sm">{details.name}</div>
                {daysLeft !== undefined && (
                    <div className="text-xs opacity-90">
                        {isExpired ? '已过期' : isExpiringSoon ? `${daysLeft}天后到期` : `剩余${daysLeft}天`}
                    </div>
                )}
            </div>
            {isExpiringSoon && !isExpired && <AlertCircle className="w-4 h-4" />}
        </div>
    );
}
