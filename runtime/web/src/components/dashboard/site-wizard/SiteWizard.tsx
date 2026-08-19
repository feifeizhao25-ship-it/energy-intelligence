'use client';

import React, { useState, useEffect } from 'react';
import {
    MapPin,
    Search,
    Loader2,
    CheckCircle2,
    ArrowRight,
    Zap,
    ShieldCheck,
    AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EnergyCompareTable } from './EnergyCompareTable';
import { RecommendationCard } from './RecommendationCard';
import { UpgradeModal } from './UpgradeModal';
// import { UpgradeModal } from './UpgradeModal'; // Keep import
import { SiteComparisonOutput, EnergyResult } from '@/types/comparison';

interface SiteWizardProps {
    onComplete?: (result: SiteComparisonOutput) => void;
}

type WizardStep = 'select' | 'assessing' | 'result';

export const SiteWizard: React.FC<SiteWizardProps> = ({ onComplete }) => {
    const [step, setStep] = useState<WizardStep>('select');
    const [address, setAddress] = useState('');
    const [province, setProvince] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [result, setResult] = useState<SiteComparisonOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [aiExplanation, setAiExplanation] = useState<any>(null);
    const [isExplaining, setIsExplaining] = useState(false);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [unlockedProject, setUnlockedProject] = useState<any>(null);

    const startAssessment = async (coords: { lat: number, lng: number, province: string, address: string }) => {
        setStep('assessing');
        setError(null);

        try {
            // 1. 获取对比结果
            const res = await fetch('/api/calculate/comparison', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(coords)
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || '计算失败');

            setResult(data.data);
            setStep('result');
            onComplete?.(data.data);

            // 2. 异步获取 AI 深度解释
            setIsExplaining(true);
            const aiRes = await fetch('/api/ai/tool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toolName: 'explain_site_recommendation',
                    toolInput: { comparisonResult: data.data }
                })
            });
            const aiData = await aiRes.json();
            // AI tool output is now object { output: { summary, reasons... } } or just output
            setAiExplanation(aiData.output || aiData);
        } catch (err: any) {
            setError(err.message);
            setStep('select');
        } finally {
            setIsExplaining(false);
        }
    };

    const handleUnlock = async () => {
        if (!result) return;
        setIsUnlocking(true);
        setError(null);

        try {
            // 1. 调用解锁 API 创建项目
            const res = await fetch('/api/projects/unlock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comparisonResult: result })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || '解锁失败');

            setUnlockedProject(data.data);
            setShowUpgrade(false);

            // 2. 触发报告下载
            // AI explanation is object, need to stringify or pass simplified version if API expects string
            // But API now expects object or handles it. Passing encoded JSON might be too long for URL.
            // For now, pass summary only or handle in API? API handles object if passed in body?
            // Wait, download is GET. We can't pass large JSON in URL.
            // Better to rely on what's in DB or pass simple summary.
            // Actually, for Phase 1, we can just pass the summary string.
            const summary = aiExplanation?.summary || '详细报告';
            const downloadUrl = `/api/projects/report?projectId=${data.data.id}&aiExplanation=${encodeURIComponent(summary)}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `Engineering_Report_${data.data.id}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleSearch = async () => {
        if (!address) return;
        setIsSearching(true);
        setError(null);

        try {
            // 使用 geocode_address 工具 (通过通用 AI tool API)
            const res = await fetch('/api/ai/tool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toolName: 'geocode_address',
                    toolInput: { address }
                })
            });
            const data = await res.json();

            if (data.output && data.output.points && data.output.points[0]) {
                const point = data.output.points[0];
                // 提取省份
                const prov = point.province || province || '河北'; // Fallback
                await startAssessment({
                    lat: parseFloat(point.lat),
                    lng: parseFloat(point.lng),
                    province: prov,
                    address: point.formattedAddress || address
                });
            } else {
                throw new Error('未能找到该地址，请尝试更详细的描述（如：xx省xx市xx区xx路）');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* Progress Indicator */}
            <div className="flex items-center justify-between mb-8 px-4">
                {[
                    { id: 'select', label: '选址', icon: MapPin },
                    { id: 'assessing', label: '评估', icon: Loader2 },
                    { id: 'result', label: '结果', icon: CheckCircle2 },
                ].map((s, i) => {
                    const isActive = step === s.id;
                    const isDone = (step === 'assessing' && i < 1) || (step === 'result' && i < 2);
                    const Icon = s.icon;

                    return (
                        <React.Fragment key={s.id}>
                            <div className="flex flex-col items-center gap-2 relative z-10">
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                    isActive ? "bg-green-500 text-white shadow-lg shadow-green-500/30 scale-110" :
                                        isDone ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
                                )}>
                                    {isDone ? <CheckCircle2 className="w-6 h-6" /> : <Icon className={cn("w-5 h-5", isActive && "animate-pulse")} />}
                                </div>
                                <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-widest",
                                    isActive ? "text-green-600" : "text-slate-400"
                                )}>{s.label}</span>
                            </div>
                            {i < 2 && (
                                <div className="flex-1 h-0.5 bg-slate-100 mx-2 -mt-6">
                                    <div
                                        className="h-full bg-green-500 transition-all duration-500"
                                        style={{ width: isDone ? '100%' : '0%' }}
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {step === 'select' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-black text-slate-900">智能选点，一键内投</h2>
                        <p className="text-slate-500 text-sm">输入您的电网站址或项目所在地，AI 将自动分析资源环境及经济性。</p>
                    </div>

                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search className="w-5 h-5 text-slate-400 group-focus-within:text-green-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="搜索地点、经纬度或粘贴地址..."
                            className="w-full pl-12 pr-32 py-5 bg-white border-2 border-slate-100 rounded-3xl text-sm focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all shadow-sm"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isSearching || !address}
                            className="absolute right-2 inset-y-2 px-6 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white text-xs font-bold rounded-2xl transition-all flex items-center gap-2"
                        >
                            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : '开始分析'}
                        </button>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 text-xs leading-relaxed animate-in shake duration-500">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2">
                            <Zap className="w-5 h-5 text-amber-500" />
                            <div className="font-bold text-xs text-slate-700">自动资源获取</div>
                            <p className="text-[10px] text-slate-400">调用 NASA 气象数据，分析过去 40 年日照与风速。</p>
                        </div>
                        <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2">
                            <ShieldCheck className="w-5 h-5 text-blue-500" />
                            <div className="font-bold text-xs text-slate-700">政策自动匹配</div>
                            <p className="text-[10px] text-slate-400">自动同步当地最新电价政策与补贴标准。</p>
                        </div>
                    </div>
                </div>
            )}

            {step === 'assessing' && (
                <div className="py-20 flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-green-500/20 rounded-full animate-ping absolute inset-0" />
                        <div className="w-24 h-24 border-4 border-t-green-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin relative z-10" />
                        <div className="absolute inset-0 flex items-center justify-center font-black text-green-600">
                            {/* Progress text? */}
                            AI
                        </div>
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="font-bold text-slate-900">正在生成多能种对比报告...</h3>
                        <p className="text-xs text-slate-400">正在获取 NASA 气象数据并模拟 25 年财务模型</p>
                    </div>
                    <div className="w-full max-w-xs h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 animate-progress w-full" />
                    </div>
                </div>
            )}

            {step === 'result' && result && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <RecommendationCard
                        type={result.recommendation.type}
                        reason={result.recommendation.reasonSummary[0]}
                        explanation={aiExplanation?.summary}
                        isLoading={isExplaining}
                        onUpgrade={() => setShowUpgrade(true)}
                    />

                    <div className="text-sm font-black text-slate-900 px-1">方案收益对比</div>
                    <EnergyCompareTable
                        solutions={[result.solar, result.wind, result.storage, result.hybrid].filter(s => s && s.irr !== null)}
                        recommendedType={result.recommendation.type}
                    />

                    <button
                        onClick={() => setStep('select')}
                        className="w-full py-4 bg-white border-2 border-slate-100 text-slate-400 text-xs font-bold rounded-2xl hover:bg-slate-50 transition-all"
                    >
                        重新选择位置
                    </button>
                </div>
            )}

            <UpgradeModal
                isOpen={showUpgrade}
                onClose={() => setShowUpgrade(false)}
                onConfirm={handleUnlock}
                isLoading={isUnlocking}
                projectName={result?.address || '新能源站点评估'}
            />
        </div>
    );
};
