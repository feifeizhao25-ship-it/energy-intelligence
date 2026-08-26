'use client';

import React, { useState, useMemo } from 'react';
import {
    Gift,
    Users,
    Copy,
    Check,
    Share2,
    QrCode,
    Crown,
    TrendingUp,
    ChevronRight,
    Sparkles,
    DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    REFERRAL_REWARDS,
    REFERRAL_LEVELS,
    SHARE_PLATFORMS,
    calculateReferralStats,
    generateShareText,
    generateShareUrl,
    ReferralRecord,
} from '@/lib/referral/referral';

// Mock data
const mockReferralCode = 'NYXA5K2M8P';
const mockRecords: ReferralRecord[] = [
    {
        id: '1',
        inviterId: 'user1',
        inviteeId: 'user2',
        inviteePhone: '138****1234',
        status: 'paid',
        reward: { proDays: 7, cash: 10 },
        createdAt: new Date('2026-01-10'),
        paidAt: new Date('2026-01-12'),
    },
    {
        id: '2',
        inviterId: 'user1',
        inviteeId: 'user3',
        inviteePhone: '139****5678',
        status: 'registered',
        reward: { proDays: 7 },
        createdAt: new Date('2026-01-13'),
    },
    {
        id: '3',
        inviterId: 'user1',
        inviteeId: 'user4',
        inviteePhone: '135****9012',
        status: 'registered',
        reward: { proDays: 7 },
        createdAt: new Date('2026-01-14'),
    },
];

export default function ReferralPage() {
    const [copied, setCopied] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);

    const stats = useMemo(() => calculateReferralStats(mockRecords), []);
    const shareUrl = generateShareUrl(mockReferralCode);
    const shareText = generateShareText('用户', mockReferralCode);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async (platform: string) => {
        if (platform === 'copy') {
            handleCopy();
            return;
        }

        // 其他平台分享逻辑
        if (navigator.share) {
            try {
                await navigator.share({
                    title: shareText.title,
                    text: shareText.description,
                    url: shareUrl,
                });
            } catch (err) {
                // 用户取消分享
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white px-6 py-12">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <Gift className="w-8 h-8" />
                        <h1 className="text-3xl font-black">邀请好友</h1>
                    </div>
                    <p className="text-primary-100">邀请好友一起使用，双方都有奖励</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 -mt-6">
                {/* Invite Code Card */}
                <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
                    <div className="text-center mb-6">
                        <div className="text-sm font-bold text-slate-500 mb-2">我的邀请码</div>
                        <div className="text-4xl font-black text-slate-900 tracking-widest">
                            {mockReferralCode}
                        </div>
                    </div>

                    {/* Share Buttons */}
                    <div className="flex gap-3 mb-6">
                        <button
                            onClick={handleCopy}
                            className="flex-1 bg-primary-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary-600 transition-colors shadow-primary"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-5 h-5" />
                                    已复制
                                </>
                            ) : (
                                <>
                                    <Copy className="w-5 h-5" />
                                    复制链接
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => setShowQRModal(true)}
                            className="flex-1 bg-slate-100 text-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                        >
                            <QrCode className="w-5 h-5" />
                            二维码
                        </button>
                    </div>

                    {/* Share Platforms */}
                    <div className="border-t border-slate-100 pt-6">
                        <div className="text-sm font-bold text-slate-500 mb-4 text-center">分享到</div>
                        <div className="flex justify-center gap-4">
                            {SHARE_PLATFORMS.map(platform => (
                                <button
                                    key={platform.id}
                                    onClick={() => handleShare(platform.id)}
                                    className="flex flex-col items-center gap-2 p-3 hover:bg-slate-50 rounded-xl transition-colors"
                                >
                                    <span className="text-2xl">{platform.icon}</span>
                                    <span className="text-xs font-medium text-slate-500">{platform.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Rewards Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-2xl border border-slate-100 p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                                <Gift className="w-5 h-5 text-primary-600" />
                            </div>
                            <div className="font-bold text-slate-900">邀请人奖励</div>
                        </div>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2 text-slate-600">
                                <Sparkles className="w-4 h-4 text-primary-500" />
                                每邀请1人送 <span className="font-bold text-primary-600">{REFERRAL_REWARDS.inviter.proDays}天</span> 专业版
                            </li>
                            <li className="flex items-center gap-2 text-slate-600">
                                <DollarSign className="w-4 h-4 text-amber-500" />
                                好友付费返现 <span className="font-bold text-amber-600">¥{REFERRAL_REWARDS.inviter.cashback}</span>
                            </li>
                        </ul>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                <Users className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="font-bold text-slate-900">被邀请人奖励</div>
                        </div>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2 text-slate-600">
                                <Sparkles className="w-4 h-4 text-primary-500" />
                                注册即送 <span className="font-bold text-primary-600">{REFERRAL_REWARDS.invitee.proDays}天</span> 专业版
                            </li>
                            <li className="flex items-center gap-2 text-slate-600">
                                <Gift className="w-4 h-4 text-amber-500" />
                                首次付费享 <span className="font-bold text-amber-600">{REFERRAL_REWARDS.invitee.discount}%</span> 折扣
                            </li>
                        </ul>
                    </div>
                </div>

                {/* My Stats */}
                <div className="bg-white rounded-3xl border border-slate-100 p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-900">我的邀请成绩</h3>
                        <div className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold",
                            "bg-primary-100 text-primary-700"
                        )}>
                            {stats.level.name}
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="text-center">
                            <div className="text-2xl font-black text-slate-900">{stats.totalInvited}</div>
                            <div className="text-xs text-slate-500">总邀请</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-primary-600">{stats.registeredCount}</div>
                            <div className="text-xs text-slate-500">已注册</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-primary-600">{stats.paidCount}</div>
                            <div className="text-xs text-slate-500">已付费</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-amber-600">{stats.totalProDays}天</div>
                            <div className="text-xs text-slate-500">累计奖励</div>
                        </div>
                    </div>

                    {/* Level Progress */}
                    <div className="bg-slate-50 rounded-2xl p-4">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-bold text-slate-700">{stats.level.name}</span>
                            {stats.nextLevelProgress < 100 && (
                                <span className="text-slate-500">
                                    再邀请 {REFERRAL_LEVELS.find(l => l.threshold > stats.registeredCount)!.threshold - stats.registeredCount} 人升级
                                </span>
                            )}
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary-500 rounded-full transition-all"
                                style={{ width: `${stats.nextLevelProgress}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Invite Records */}
                <div className="bg-white rounded-3xl border border-slate-100 p-6">
                    <h3 className="font-bold text-slate-900 mb-4">邀请记录</h3>

                    {mockRecords.length === 0 ? (
                        <div className="text-center py-8">
                            <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="text-slate-500">还没有邀请记录</p>
                            <p className="text-sm text-slate-400">快去分享邀请码吧~</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {mockRecords.map(record => (
                                <div key={record.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                                            <Users className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">{record.inviteePhone}</div>
                                            <div className="text-xs text-slate-500">
                                                {new Date(record.createdAt).toLocaleDateString('zh-CN')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn(
                                            "text-xs font-bold px-2 py-1 rounded-full",
                                            record.status === 'paid'
                                                ? "bg-primary-100 text-primary-700"
                                                : "bg-slate-200 text-slate-600"
                                        )}>
                                            {record.status === 'paid' ? '已付费' : '已注册'}
                                        </div>
                                        <div className="text-xs text-primary-600 mt-1">
                                            +{record.reward.proDays}天
                                            {record.reward.cash && ` +¥${record.reward.cash}`}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Level System */}
                <div className="mt-6 bg-white rounded-3xl border border-slate-100 p-6">
                    <h3 className="font-bold text-slate-900 mb-4">推广等级</h3>
                    <div className="space-y-3">
                        {REFERRAL_LEVELS.map((level, index) => (
                            <div
                                key={level.level}
                                className={cn(
                                    "flex items-center justify-between p-4 rounded-2xl transition-all",
                                    stats.level.level >= level.level
                                        ? "bg-primary-50 border border-primary-200"
                                        : "bg-slate-50"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center",
                                        stats.level.level >= level.level
                                            ? "bg-primary-500 text-white"
                                            : "bg-slate-200 text-slate-400"
                                    )}>
                                        <Crown className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900">{level.name}</div>
                                        <div className="text-xs text-slate-500">邀请 {level.threshold} 人</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={cn(
                                        "font-bold",
                                        stats.level.level >= level.level ? "text-primary-600" : "text-slate-400"
                                    )}>
                                        {level.bonus > 0 ? `+${level.bonus}天/人` : '基础奖励'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* QR Code Modal */}
            {showQRModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">扫码加入</h3>
                        <div className="w-48 h-48 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <QrCode className="w-24 h-24 text-slate-300" />
                        </div>
                        <p className="text-sm text-slate-500 mb-2">邀请码: {mockReferralCode}</p>
                        <p className="text-xs text-slate-400 mb-6">扫描二维码或分享邀请链接</p>
                        <button
                            onClick={() => setShowQRModal(false)}
                            className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
