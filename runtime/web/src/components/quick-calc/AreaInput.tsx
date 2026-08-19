'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface AreaInputProps {
    value: string;
    onChange: (value: string) => void;
    presets: number[];
    unit: string;
    label: string;
    type: 'solar' | 'wind' | 'storage';
    description?: string;
}

export default function AreaInput({
    value,
    onChange,
    presets,
    unit,
    label,
    type,
    description
}: AreaInputProps) {
    const getActiveStyles = () => {
        switch (type) {
            case 'solar': return "border-solar-500 focus:ring-solar-500";
            case 'wind': return "border-wind-500 focus:ring-wind-500";
            case 'storage': return "border-storage-500 focus:ring-storage-500";
            default: return "border-primary-500 focus:ring-primary-500";
        }
    };

    const getPresetStyles = (isCurrent: boolean) => {
        if (!isCurrent) return "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-100";

        switch (type) {
            case 'solar': return "bg-solar-500 text-white border-solar-500 shadow-md shadow-solar-100";
            case 'wind': return "bg-wind-500 text-white border-wind-500 shadow-md shadow-wind-100";
            case 'storage': return "bg-storage-500 text-white border-storage-500 shadow-md shadow-storage-100";
            default: return "bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-100";
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <label className="text-xl font-bold text-slate-900 block">
                    {label}
                </label>
                {description && <p className="text-slate-500 text-sm">{description}</p>}
            </div>

            <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                    <button
                        key={preset}
                        onClick={() => onChange(preset.toString())}
                        className={cn(
                            "px-6 py-3 rounded-2xl border-2 font-bold transition-all duration-300",
                            getPresetStyles(value === preset.toString())
                        )}
                    >
                        {preset}{unit}
                    </button>
                ))}
                <button
                    onClick={() => onChange('')}
                    className={cn(
                        "px-6 py-3 rounded-2xl border-2 font-bold transition-all duration-300",
                        getPresetStyles(value !== '' && !presets.includes(Number(value)))
                    )}
                >
                    自定义
                </button>
            </div>

            <div className="relative max-w-sm">
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="请输入具体数值"
                    className={cn(
                        "w-full px-6 py-4 rounded-2xl border-2 outline-none transition-all duration-300 text-2xl font-bold pr-16",
                        getActiveStyles()
                    )}
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                    {unit}
                </span>
            </div>
        </div>
    );
}
