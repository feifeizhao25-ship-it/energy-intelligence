'use client';

import React from 'react';
import { Leaf, TreePine, Car, Factory } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EcoContributionProps {
    annualGeneration: number;  // 年发电量 kWh
    projectYears?: number;     // 项目年限
    energyType?: 'solar' | 'wind' | 'storage';
}

// CO2减排系数：每kWh发电减排约0.5839kg CO2（中国电网平均）
const CO2_FACTOR = 0.5839;
// 一棵成年树年吸收CO2约18kg
const TREE_ABSORPTION = 18;
// 汽车每公里排放约0.25kg CO2
const CAR_EMISSION_PER_KM = 0.25;

export default function EcoContribution({
    annualGeneration,
    projectYears = 25,
    energyType = 'solar'
}: EcoContributionProps) {
    // 计算环保贡献
    const annualCO2 = (annualGeneration * CO2_FACTOR) / 1000; // 吨
    const totalCO2 = annualCO2 * projectYears;
    const trees = Math.round(annualCO2 * 1000 / TREE_ABSORPTION);
    const carKm = Math.round((annualCO2 * 1000) / CAR_EMISSION_PER_KM);

    const stats = [
        {
            icon: Factory,
            value: annualCO2.toFixed(1),
            unit: '吨/年',
            label: '年减排 CO₂',
            color: 'text-primary-600',
            bgColor: 'bg-primary-50',
        },
        {
            icon: TreePine,
            value: trees.toLocaleString(),
            unit: '棵',
            label: '相当于种植',
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
        },
        {
            icon: Car,
            value: (carKm / 1000).toFixed(1),
            unit: '万公里',
            label: '相当于少开车',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
        },
    ];

    return (
        <div className="bg-gradient-to-br from-primary-50 to-emerald-50 rounded-3xl p-8 border border-primary-100">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900">🌱 环保贡献</h3>
                    <p className="text-xs text-slate-500">您的清洁能源项目将带来的环境效益</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
                {stats.map((stat, index) => (
                    <div
                        key={stat.label}
                        className={cn(
                            "bg-white rounded-2xl p-4 text-center transition-all hover:shadow-md",
                            "animate-in fade-in slide-in-from-bottom-4",
                        )}
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        <div className={cn("w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center", stat.bgColor)}>
                            <stat.icon className={cn("w-6 h-6", stat.color)} />
                        </div>
                        <div className="text-xs font-medium text-slate-500 mb-1">{stat.label}</div>
                        <div className={cn("text-2xl font-black", stat.color)}>
                            {stat.value}
                            <span className="text-sm font-normal ml-1">{stat.unit}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Total Impact */}
            <div className="mt-6 bg-white/80 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                        <span className="font-bold">{projectYears}年</span> 累计减排 CO₂
                    </div>
                    <div className="text-2xl font-black text-primary-600">
                        {totalCO2.toFixed(0)} 吨
                    </div>
                </div>
                <div className="mt-2 w-full bg-primary-100 h-2 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full animate-pulse"
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

            {/* Fun Fact */}
            <div className="mt-4 text-center text-xs text-slate-500 italic">
                💡 这相当于一片 {Math.round(trees / 100)} 亩的森林一年的碳吸收量
            </div>
        </div>
    );
}
