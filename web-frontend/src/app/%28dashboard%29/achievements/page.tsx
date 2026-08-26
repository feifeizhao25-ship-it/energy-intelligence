'use client';

import React, { useState, useMemo } from 'react';
import {
    Trophy,
    Lock,
    Star,
    Gift,
    ChevronRight,
    Sparkles,
    TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    allAchievements,
    AchievementCategory,
    categoryConfig,
    getAchievementsByCategory,
} from '@/lib/achievements/achievements';
import {
    UserStats,
    getAchievementProgress,
    getNextAchievements,
    formatProgressText,
} from '@/lib/achievements/check';

// Mock user data - 实际应从API获取
const mockUserStats: UserStats = {
    totalGeneration: 15680,
    stationCount: 1,
    recordStreak: 12,
    totalRecords: 45,
    aiChatCount: 23,
    questionCount: 2,
    answerCount: 5,
    totalLikes: 18,
    referralCount: 1,
    calcCount: 8,
};

const mockUnlockedAchievements = ['first_calc', 'first_station', 'gen_1k', 'gen_10k', 'carbon_1t', 'streak_7'];

export default function AchievementsPage() {
    const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'all'>('all');
    const [stats] = useState<UserStats>(mockUserStats);
    const [unlocked] = useState<string[]>(mockUnlockedAchievements);

    // 过滤成就
    const displayedAchievements = useMemo(() => {
        if (selectedCategory === 'all') {
            return allAchievements.filter(a => !a.secret || unlocked.includes(a.id));
        }
        return getAchievementsByCategory(selectedCategory).filter(a => !a.secret || unlocked.includes(a.id));
    }, [selectedCategory, unlocked]);

    // 即将解锁的成就
    const upcomingAchievements = useMemo(() => {
        return getNextAchievements(stats, unlocked, 3);
    }, [stats, unlocked]);

    // 统计
    const unlockedCount = unlocked.length;
    const totalCount = allAchievements.filter(a => !a.secret).length;
    const progressPercent = Math.round((unlockedCount / totalCount) * 100);

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white px-6 py-12">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <Trophy className="w-8 h-8" />
                        <h1 className="text-3xl font-black">我的成就</h1>
                    </div>
                    <p className="text-primary-100 mb-8">记录你的清洁能源之旅</p>

                    {/* Progress Overview */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-bold">成就进度</span>
                            <span className="text-2xl font-black">{unlockedCount} / {totalCount}</span>
                        </div>
                        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="mt-4 flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-amber-400" />
                                <span className="text-sm">发电 {unlocked.filter(id => id.startsWith('gen_')).length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-400" />
                                <span className="text-sm">环保 {unlocked.filter(id => id.startsWith('carbon_')).length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-400" />
                                <span className="text-sm">使用 {unlocked.filter(id => id.startsWith('streak_') || id.startsWith('first_')).length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 -mt-6">
                {/* Upcoming Achievements */}
                {upcomingAchievements.length > 0 && (
                    <div className="bg-white rounded-3xl border border-slate-100 p-6 mb-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-primary-500" />
                            <span className="font-bold text-slate-900">即将解锁</span>
                        </div>
                        <div className="space-y-3">
                            {upcomingAchievements.map(({ achievement, progress }) => (
                                <div key={achievement.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl">
                                    <span className="text-2xl">{achievement.icon}</span>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-slate-900">{achievement.name}</span>
                                            <span className="text-xs font-bold text-primary-600">{progress}%</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary-500 rounded-full transition-all"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Category Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={cn(
                            "px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all",
                            selectedCategory === 'all'
                                ? "bg-primary-500 text-white shadow-primary"
                                : "bg-white text-slate-600 border border-slate-200 hover:border-primary-300"
                        )}
                    >
                        全部
                    </button>
                    {Object.entries(categoryConfig).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => setSelectedCategory(key as AchievementCategory)}
                            className={cn(
                                "px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all flex items-center gap-1",
                                selectedCategory === key
                                    ? "bg-primary-500 text-white shadow-primary"
                                    : "bg-white text-slate-600 border border-slate-200 hover:border-primary-300"
                            )}
                        >
                            <span>{config.icon}</span>
                            {config.name}
                        </button>
                    ))}
                </div>

                {/* Achievements Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayedAchievements.map((achievement) => {
                        const isUnlocked = unlocked.includes(achievement.id);
                        const { percentage } = getAchievementProgress(achievement, stats);
                        const progressText = formatProgressText(achievement, stats);

                        return (
                            <div
                                key={achievement.id}
                                className={cn(
                                    "bg-white rounded-3xl border p-6 transition-all",
                                    isUnlocked
                                        ? "border-primary-200 shadow-sm"
                                        : "border-slate-100 opacity-70"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className={cn(
                                        "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl",
                                        isUnlocked
                                            ? categoryConfig[achievement.category].bgColor
                                            : "bg-slate-100"
                                    )}>
                                        {isUnlocked ? achievement.icon : <Lock className="w-6 h-6 text-slate-300" />}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className={cn(
                                                "font-bold",
                                                isUnlocked ? "text-slate-900" : "text-slate-400"
                                            )}>
                                                {achievement.name}
                                            </h3>
                                            {isUnlocked && (
                                                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                            )}
                                        </div>
                                        <p className={cn(
                                            "text-sm",
                                            isUnlocked ? "text-slate-600" : "text-slate-400"
                                        )}>
                                            {achievement.description}
                                        </p>

                                        {/* Progress or Reward */}
                                        {isUnlocked ? (
                                            achievement.reward && (
                                                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-full w-fit">
                                                    <Gift className="w-3 h-3" />
                                                    {achievement.reward.type === 'pro_days' && `获得 ${achievement.reward.value} 天专业版`}
                                                    {achievement.reward.type === 'discount' && `获得 ${achievement.reward.value}% 折扣`}
                                                    {achievement.reward.type === 'badge' && '已获得徽章'}
                                                </div>
                                            )
                                        ) : (
                                            achievement.threshold && (
                                                <div className="mt-3">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="text-slate-400">{progressText}</span>
                                                        <span className="text-slate-500">{percentage}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-slate-300 rounded-full"
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Empty State */}
                {displayedAchievements.length === 0 && (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trophy className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">暂无成就</h3>
                        <p className="text-slate-500">开始使用，解锁你的第一个成就</p>
                    </div>
                )}

                {/* Tips */}
                <div className="mt-8 bg-primary-50 rounded-3xl p-6 border border-primary-100">
                    <div className="flex items-center gap-3 mb-3">
                        <Sparkles className="w-5 h-5 text-primary-600" />
                        <span className="font-bold text-primary-900">成就小贴士</span>
                    </div>
                    <ul className="text-sm text-primary-700 space-y-2">
                        <li>• 每天录入发电数据可以累计连续记录天数</li>
                        <li>• 解锁成就可获得专业版体验天数或折扣券</li>
                        <li>• 邀请好友注册可解锁推广成就</li>
                        <li>• 隐藏成就需要特殊条件才能发现</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
