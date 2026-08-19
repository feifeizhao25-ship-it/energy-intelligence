'use client';

import React from 'react';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResultFlowChartProps {
    investment: number;      // 投入（万元）
    paybackYears: number;    // 回本年数
    netProfit: number;       // 净赚（万元）
    totalRevenue: number;    // 总收益（万元）
    projectYears?: number;   // 项目年限，默认25年
}

export default function ResultFlowChart({
    investment,
    paybackYears,
    netProfit,
    totalRevenue,
    projectYears = 25
}: ResultFlowChartProps) {
    const steps = [
        {
            label: '💵 投入',
            value: `¥${investment.toFixed(1)}万`,
            sublabel: '一次性投资',
            color: 'bg-slate-100 border-slate-200 text-slate-700',
            iconBg: 'bg-slate-200',
        },
        {
            label: '⏱️ 回本',
            value: `${paybackYears.toFixed(1)}年`,
            sublabel: '投资回收期',
            color: 'bg-primary-50 border-primary-200 text-primary-700',
            iconBg: 'bg-primary-200',
        },
        {
            label: '🎯 净赚',
            value: `¥${netProfit.toFixed(1)}万`,
            sublabel: `${projectYears}年纯利润`,
            color: 'bg-primary-100 border-primary-300 text-primary-800',
            iconBg: 'bg-primary-300',
            highlight: true,
        },
    ];

    return (
        <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-primary-500" />
                <span className="font-bold text-slate-900">投资回报流程</span>
            </div>

            <div className="flex items-center justify-between gap-2">
                {steps.map((step, index) => (
                    <React.Fragment key={step.label}>
                        {/* Step Card */}
                        <div
                            className={cn(
                                "flex-1 p-5 rounded-2xl border-2 transition-all",
                                step.color,
                                step.highlight && "ring-2 ring-primary-400 ring-offset-2 shadow-lg"
                            )}
                        >
                            <div className="text-center">
                                <div className="text-sm font-bold mb-2 opacity-80">{step.label}</div>
                                <div className={cn(
                                    "text-2xl md:text-3xl font-black tracking-tight",
                                    step.highlight && "text-primary-600"
                                )}>
                                    {step.value}
                                </div>
                                <div className="text-xs font-medium mt-2 opacity-60">{step.sublabel}</div>
                            </div>
                        </div>

                        {/* Arrow */}
                        {index < steps.length - 1 && (
                            <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                                    <ArrowRight className="w-5 h-5 text-slate-400" />
                                </div>
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Progress Bar */}
            <div className="mt-8">
                <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
                    <span>投资开始</span>
                    <span>回本点 ({paybackYears.toFixed(1)}年)</span>
                    <span>{projectYears}年到期</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
                    {/* 回本前（红色区域） */}
                    <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-slate-300 to-slate-400 rounded-l-full"
                        style={{ width: `${(paybackYears / projectYears) * 100}%` }}
                    />
                    {/* 回本后（绿色区域） */}
                    <div
                        className="absolute top-0 h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-r-full"
                        style={{
                            left: `${(paybackYears / projectYears) * 100}%`,
                            width: `${100 - (paybackYears / projectYears) * 100}%`
                        }}
                    />
                    {/* 回本点标记 */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-primary-500 rounded-full shadow-lg"
                        style={{ left: `calc(${(paybackYears / projectYears) * 100}% - 8px)` }}
                    />
                </div>
                <div className="flex justify-between text-xs font-medium mt-2">
                    <span className="text-slate-500">回本前：收回成本</span>
                    <span className="text-primary-600">回本后：纯利润 ¥{netProfit.toFixed(1)}万</span>
                </div>
            </div>
        </div>
    );
}
