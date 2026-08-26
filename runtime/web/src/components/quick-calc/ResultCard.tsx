'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricProps {
    label: string;
    value: string;
    subValue?: string;
    icon?: LucideIcon;
    type: 'solar' | 'wind' | 'storage' | 'neutral';
}

export function MetricCard({ label, value, subValue, icon: Icon, type }: MetricProps) {
    const getColors = () => {
        switch (type) {
            case 'solar': return "text-solar-600 bg-solar-50 border-solar-100";
            case 'wind': return "text-wind-600 bg-wind-50 border-wind-100";
            case 'storage': return "text-storage-600 bg-storage-50 border-storage-100";
            default: return "text-slate-600 bg-slate-50 border-slate-100";
        }
    };

    return (
        <div className={cn("p-6 rounded-3xl border transition-all duration-300", getColors())}>
            <div className="flex items-center gap-2 mb-2">
                {Icon && <Icon className="w-4 h-4 opacity-70" />}
                <span className="text-sm font-bold opacity-80 uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-3xl font-black">{value}</div>
            {subValue && <div className="text-xs mt-1 font-medium opacity-60">{subValue}</div>}
        </div>
    );
}

interface ResultCardProps {
    title: string;
    mainValue: string;
    mainLabel: string;
    subHighlight: string;
    type: 'solar' | 'wind' | 'storage';
    children?: React.ReactNode;
}

export default function ResultCard({
    title,
    mainValue,
    mainLabel,
    subHighlight,
    type,
    children
}: ResultCardProps) {
    const getHeaderColors = () => {
        switch (type) {
            case 'solar': return "from-solar-500 to-solar-600";
            case 'wind': return "from-wind-500 to-wind-600";
            case 'storage': return "from-storage-500 to-storage-600";
        }
    };

    const getHighlightColors = () => {
        switch (type) {
            case 'solar': return "bg-solar-50 text-solar-700";
            case 'wind': return "bg-wind-50 text-wind-700";
            case 'storage': return "bg-storage-50 text-storage-700";
        }
    };

    return (
        <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200 overflow-hidden border border-slate-100">
            <div className={cn("p-8 md:p-12 text-center text-white bg-gradient-to-br", getHeaderColors())}>
                <h2 className="text-xl font-bold opacity-80 mb-6">{title}</h2>
                <div className="text-6xl md:text-8xl font-black tracking-tighter mb-4">
                    {mainValue}
                </div>
                <div className="text-lg font-bold opacity-90 mb-8">{mainLabel}</div>

                <div className={cn(
                    "inline-flex items-center px-6 py-3 rounded-2xl font-black text-lg",
                    getHighlightColors()
                )}>
                    {subHighlight}
                </div>
            </div>

            <div className="p-8 md:p-12">
                {children}
            </div>
        </div>
    );
}
