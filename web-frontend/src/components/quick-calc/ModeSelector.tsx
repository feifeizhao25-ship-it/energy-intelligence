'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

export interface ModeOption {
    id: string;
    title: string;
    description: string;
    isRecommended?: boolean;
}

interface ModeSelectorProps {
    options: ModeOption[];
    selectedId: string;
    onSelect: (id: string) => void;
    type: 'solar' | 'wind' | 'storage';
}

export default function ModeSelector({ options, selectedId, onSelect, type }: ModeSelectorProps) {
    const getActiveStyles = (isSelected: boolean) => {
        if (!isSelected) return "border-slate-100 bg-white hover:border-slate-200";

        switch (type) {
            case 'solar': return "border-solar-500 bg-solar-50/50 ring-1 ring-solar-500";
            case 'wind': return "border-wind-500 bg-wind-50/50 ring-1 ring-wind-500";
            case 'storage': return "border-storage-500 bg-storage-50/50 ring-1 ring-storage-500";
            default: return "border-primary-500 bg-primary-50/50 ring-1 ring-primary-500";
        }
    };

    const getCheckStyles = () => {
        switch (type) {
            case 'solar': return "text-solar-500";
            case 'wind': return "text-wind-500";
            case 'storage': return "text-storage-500";
            default: return "text-primary-500";
        }
    };

    const getTagStyles = () => {
        switch (type) {
            case 'solar': return "bg-solar-500 text-white";
            case 'wind': return "bg-wind-500 text-white";
            case 'storage': return "bg-storage-500 text-white";
            default: return "bg-primary-500 text-white";
        }
    };

    return (
        <div className="space-y-4">
            {options.map((option) => {
                const isSelected = selectedId === option.id;

                return (
                    <button
                        key={option.id}
                        onClick={() => onSelect(option.id)}
                        className={cn(
                            "w-full flex items-center p-6 rounded-3xl border-2 transition-all duration-300 text-left relative overflow-hidden group",
                            getActiveStyles(isSelected)
                        )}
                    >
                        {option.isRecommended && (
                            <div className={cn(
                                "absolute top-0 right-0 px-4 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest",
                                getTagStyles()
                            )}>
                                推荐方案
                            </div>
                        )}

                        <div className={cn(
                            "w-8 h-8 rounded-full border-2 flex items-center justify-center mr-6 transition-all duration-300",
                            isSelected ? getTagStyles() : "border-slate-200"
                        )}>
                            {isSelected && <CheckCircle2 className="w-5 h-5" />}
                        </div>

                        <div className="flex-1">
                            <h4 className={cn(
                                "text-lg font-bold mb-1",
                                isSelected ? "text-slate-900" : "text-slate-700"
                            )}>
                                {option.title}
                            </h4>
                            <p className="text-slate-500 text-sm">
                                {option.description}
                            </p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
