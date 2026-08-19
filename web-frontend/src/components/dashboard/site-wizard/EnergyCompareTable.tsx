'use client';

import React from 'react';
import { Zap, Wind, Battery, Sparkles, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EnergyResult } from '@/types/comparison';

interface EnergyCompareTableProps {
    solutions: EnergyResult[];
    recommendedType: string;
    onSelect?: (type: string) => void;
}

const TYPE_CONFIG = {
    SOLAR: { label: '分布式光伏', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
    WIND: { label: '分散式风电', icon: Wind, color: 'text-blue-500', bg: 'bg-blue-50' },
    STORAGE: { label: '工商业储能', icon: Battery, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    HYBRID: { label: '光储一体化', icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-50' },
};

export const EnergyCompareTable: React.FC<EnergyCompareTableProps> = ({
    solutions,
    recommendedType,
    onSelect
}) => {
    return (
        <div className="space-y-4">
            {solutions.map((sol) => {
                const config = TYPE_CONFIG[sol.type];
                const isRecommended = sol.type === recommendedType;
                const Icon = config.icon;

                return (
                    <div
                        key={sol.type}
                        onClick={() => onSelect?.(sol.type)}
                        className={cn(
                            "relative p-4 rounded-2xl border-2 transition-all cursor-pointer",
                            isRecommended
                                ? "border-green-500 bg-white shadow-md scale-[1.02]"
                                : "border-slate-100 bg-slate-50/50 hover:border-slate-200"
                        )}
                    >
                        {isRecommended && (
                            <div className="absolute -top-3 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                                <CheckCircle2 className="w-3 h-3" />
                                系统推荐
                            </div>
                        )}

                        <div className="flex items-center gap-4 mb-4">
                            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", config.bg)}>
                                <Icon className={cn("w-6 h-6", config.color)} />
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-slate-900">{config.label}</div>
                                <div className="text-xs text-slate-400">预估投资: ¥{((sol.capex || 0) / 10000).toFixed(1)}万</div>
                            </div>
                            <div className="text-right">
                                <div className={cn("text-xl font-black", isRecommended ? "text-green-600" : "text-slate-900")}>
                                    {(sol.irr || 0).toFixed(1)}%
                                </div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-wider">预期 IRR</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-slate-100/50 rounded-lg p-2 text-center">
                                <div className="text-[10px] text-slate-400 mb-0.5">回收期</div>
                                <div className="text-xs font-bold text-slate-700">{(sol.paybackYears || 0).toFixed(1)}年</div>
                            </div>
                            <div className="bg-slate-100/50 rounded-lg p-2 text-center">
                                <div className="text-[10px] text-slate-400 mb-0.5">年收益</div>
                                <div className="text-xs font-bold text-slate-700">¥{((sol.annualRevenue || 0) / 10000).toFixed(1)}万</div>
                            </div>
                            <div className="bg-slate-100/50 rounded-lg p-2 text-center">
                                <div className="text-[10px] text-slate-400 mb-0.5">风险等级</div>
                                <div className={cn(
                                    "text-[10px] font-bold flex items-center justify-center gap-1",
                                    sol.riskLevel === 'low' ? "text-green-600" :
                                        sol.riskLevel === 'medium' ? "text-amber-600" : "text-red-600"
                                )}>
                                    {sol.riskLevel === 'high' && <AlertTriangle className="w-3 h-3" />}
                                    {sol.riskLevel === 'low' ? '低风险' : sol.riskLevel === 'medium' ? '中风险' : '高风险'}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
