'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    Zap,
    Sun,
    Wind,
    Battery,
    Calculator,
    MessageSquare,
    Map,
    FileText,
    ArrowRight,
    Check,
    Sparkles,
    Target,
    TrendingUp,
    Gift
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 引导步骤
interface OnboardingOption {
    id: string;
    label: string;
    desc: string;
    icon?: any;
    path?: string;
}

interface OnboardingStep {
    id: string;
    title: string;
    subtitle: string;
    icon: any;
    options?: OnboardingOption[];
    rewards?: { label: string; value: number }[];
}

const ONBOARDING_STEPS: OnboardingStep[] = [
    {
        id: 'welcome',
        title: '欢迎加入新能源智库',
        subtitle: '让我们花1分钟了解您的需求，为您定制专属体验',
        icon: Sparkles,
    },
    {
        id: 'interest',
        title: '您最感兴趣的领域是？',
        subtitle: '选择您主要关注的新能源类型',
        icon: Target,
        options: [
            { id: 'solar', label: '分布式光伏', desc: '屋顶光伏、工商业光伏', icon: Sun },
            { id: 'wind', label: '风力发电', desc: '陆上风电、海上风电', icon: Wind },
            { id: 'storage', label: '储能系统', desc: '电化学储能、抽水蓄能', icon: Battery },
            { id: 'all', label: '综合新能源', desc: '多种能源类型组合', icon: Zap },
        ]
    },
    {
        id: 'role',
        title: '您的角色是？',
        subtitle: '帮助我们为您推荐最适合的功能',
        icon: Target,
        options: [
            { id: 'investor', label: '投资者/开发商', desc: '寻找项目投资机会' },
            { id: 'owner', label: '电站业主', desc: '管理自有电站资产' },
            { id: 'engineer', label: '工程师/技术人员', desc: '技术研究与项目设计' },
            { id: 'researcher', label: '研究人员/学生', desc: '学术研究与学习' },
        ]
    },
    {
        id: 'goal',
        title: '您想第一个尝试什么？',
        subtitle: '我们将引导您完成首次操作',
        icon: TrendingUp,
        options: [
            { id: 'calculate', label: '项目收益测算', desc: '评估光伏/风电项目收益', icon: Calculator, path: '/calculator' },
            { id: 'assistant', label: 'AI智能对话', desc: '向AI专家咨询问题', icon: MessageSquare, path: '/assistant' },
            { id: 'map', label: '资源地图', desc: '查看全球辐照/风速', icon: Map, path: '/map' },
            { id: 'papers', label: '专业文献', desc: '查找行业研究报告', icon: FileText, path: '/papers' },
        ]
    },
    {
        id: 'complete',
        title: '个性化设置已完成',
        subtitle: '免费版实际额度如下，升级前可在价格方案页查看完整权益',
        icon: Gift,
        rewards: [
            { label: '每日 AI 对话', value: 3 },
            { label: '每日项目测算', value: 2 },
            { label: '最多项目数', value: 1 },
        ]
    }
];

export default function OnboardingPage() {
    const router = useRouter();
    const { data: session, update } = useSession();
    const [currentStep, setCurrentStep] = useState(0);
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [isCompleting, setIsCompleting] = useState(false);

    const step = ONBOARDING_STEPS[currentStep];
    const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

    const handleSelect = (optionId: string) => {
        setSelections(prev => ({
            ...prev,
            [step.id]: optionId
        }));
    };

    const handleNext = async () => {
        if (isLastStep) {
            setIsCompleting(true);
            try {
                // 保存用户偏好到后端
                await fetch('/api/user/onboarding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        preferences: selections,
                        completedAt: new Date().toISOString()
                    })
                });

                // 跳转到用户选择的目标页面
                const goalOption = ONBOARDING_STEPS[3].options?.find(o => o.id === selections.goal);
                const targetPath = goalOption?.path || '/dashboard';
                router.push(targetPath);
            } catch (error) {
                console.error('Failed to save onboarding:', error);
                router.push('/dashboard');
            }
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleSkip = () => {
        router.push('/dashboard');
    };

    const canProceed = step.options ? !!selections[step.id] : true;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            {/* Progress bar */}
            <div className="fixed top-0 left-0 right-0 h-1 bg-slate-800">
                <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%` }}
                />
            </div>

            <div className="w-full max-w-2xl">
                {/* Step indicator */}
                <div className="flex justify-center gap-2 mb-8">
                    {ONBOARDING_STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "w-2 h-2 rounded-full transition-all",
                                i === currentStep ? "w-8 bg-green-500" :
                                    i < currentStep ? "bg-green-500/50" : "bg-slate-700"
                            )}
                        />
                    ))}
                </div>

                {/* Card */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-8 md:p-12">
                    {/* Icon */}
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center">
                            <step.icon className="w-8 h-8 text-green-400" />
                        </div>
                    </div>

                    {/* Title */}
                    <div className="text-center mb-8">
                        <h1 className="text-2xl md:text-3xl font-black text-white mb-2">
                            {step.title}
                        </h1>
                        <p className="text-slate-400">{step.subtitle}</p>
                    </div>

                    {/* Options */}
                    {step.options && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            {step.options.map((option) => {
                                const isSelected = selections[step.id] === option.id;
                                const IconComponent = option.icon;

                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => handleSelect(option.id)}
                                        className={cn(
                                            "p-4 rounded-2xl border-2 text-left transition-all",
                                            isSelected
                                                ? "border-green-500 bg-green-500/10"
                                                : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            {IconComponent && (
                                                <div className={cn(
                                                    "p-2 rounded-lg",
                                                    isSelected ? "bg-green-500/20" : "bg-slate-700"
                                                )}>
                                                    <IconComponent className={cn(
                                                        "w-5 h-5",
                                                        isSelected ? "text-green-400" : "text-slate-400"
                                                    )} />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <div className={cn(
                                                    "font-bold mb-1",
                                                    isSelected ? "text-green-400" : "text-white"
                                                )}>
                                                    {option.label}
                                                </div>
                                                {option.desc && (
                                                    <div className="text-sm text-slate-400">{option.desc}</div>
                                                )}
                                            </div>
                                            {isSelected && (
                                                <Check className="w-5 h-5 text-green-400" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Rewards (last step) */}
                    {step.rewards && (
                        <div className="space-y-4 mb-8">
                            {step.rewards.map((reward, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-4 bg-green-500/10 rounded-xl border border-green-500/20"
                                >
                                    <span className="text-white font-bold">{reward.label}</span>
                                    <span className="text-green-400 font-black text-xl">+{reward.value}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-4">
                        {currentStep > 0 && currentStep < ONBOARDING_STEPS.length - 1 && (
                            <button
                                onClick={handleSkip}
                                className="flex-1 py-3 text-slate-400 hover:text-white font-bold transition-colors"
                            >
                                跳过
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            disabled={!canProceed || isCompleting}
                            className={cn(
                                "flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                                canProceed
                                    ? "bg-green-500 text-white hover:bg-green-600"
                                    : "bg-slate-700 text-slate-500 cursor-not-allowed"
                            )}
                        >
                            {isCompleting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    处理中...
                                </>
                            ) : isLastStep ? (
                                <>
                                    开始使用
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            ) : (
                                <>
                                    继续
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Skip all */}
                {currentStep === 0 && (
                    <div className="text-center mt-6">
                        <button
                            onClick={handleSkip}
                            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            我是老用户，跳过引导
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
