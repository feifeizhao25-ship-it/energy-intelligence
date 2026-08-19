'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface SelectionOption {
    id: string;
    title: string;
    description: string;
    icon: LucideIcon;
    subValue?: string;
}

interface TypeSelectorProps {
    options: SelectionOption[];
    selectedId: string;
    onSelect: (id: string) => void;
    type: 'solar' | 'wind' | 'storage';
}

export default function TypeSelector({ options, selectedId, onSelect, type }: TypeSelectorProps) {
    const getActiveStyles = (isSelected: boolean) => {
        if (!isSelected) return "border-slate-100 bg-white hover:border-slate-200 hover:shadow-md";

        switch (type) {
            case 'solar': return "border-solar-500 bg-solar-50 shadow-lg shadow-solar-100";
            case 'wind': return "border-wind-500 bg-wind-50 shadow-lg shadow-wind-100";
            case 'storage': return "border-storage-500 bg-storage-50 shadow-lg shadow-storage-100";
            default: return "border-primary-500 bg-primary-50 shadow-lg shadow-primary-100";
        }
    };

    const getIconStyles = (isSelected: boolean) => {
        if (!isSelected) return "bg-slate-50 text-slate-400";

        switch (type) {
            case 'solar': return "bg-solar-500 text-white";
            case 'wind': return "bg-wind-500 text-white";
            case 'storage': return "bg-storage-500 text-white";
            default: return "bg-primary-500 text-white";
        }
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {options.map((option) => {
                const isSelected = selectedId === option.id;
                const Icon = option.icon;

                return (
                    <button
                        key={option.id}
                        onClick={() => onSelect(option.id)}
                        className={cn(
                            "flex flex-col items-start p-6 rounded-3xl border-2 transition-all duration-300 text-left group",
                            getActiveStyles(isSelected)
                        )}
                    >
                        <div className={cn(
                            "p-3 rounded-2xl mb-4 transition-all duration-300 group-hover:scale-110",
                            getIconStyles(isSelected)
                        )}>
                            <Icon className="w-8 h-8" />
                        </div>
                        <h3 className={cn(
                            "text-xl font-bold mb-1",
                            isSelected ? "text-slate-900" : "text-slate-700"
                        )}>
                            {option.title}
                        </h3>
                        <p className="text-slate-500 text-sm leading-relaxed mb-4">
                            {option.description}
                        </p>
                        {option.subValue && (
                            <span className={cn(
                                "text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider",
                                isSelected ? "bg-white text-slate-700" : "bg-slate-100 text-slate-500"
                            )}>
                                {option.subValue}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
