'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
    id: number;
    name: string;
}

interface StepIndicatorProps {
    steps: Step[];
    currentStep: number;
    type: 'solar' | 'wind' | 'storage';
}

export default function StepIndicator({ steps, currentStep, type }: StepIndicatorProps) {
    const getColorClass = (stepId: number) => {
        const isCompleted = stepId < currentStep;
        const isActive = stepId === currentStep;

        if (isCompleted || isActive) {
            switch (type) {
                case 'solar': return 'bg-solar-500 text-white';
                case 'wind': return 'bg-wind-500 text-white';
                case 'storage': return 'bg-storage-500 text-white';
                default: return 'bg-primary-500 text-white';
            }
        }
        return 'bg-slate-100 text-slate-400';
    };

    const getBorderColorClass = (stepId: number) => {
        if (stepId < currentStep) {
            switch (type) {
                case 'solar': return 'border-solar-500';
                case 'wind': return 'border-wind-500';
                case 'storage': return 'border-storage-500';
                default: return 'border-primary-500';
            }
        }
        return 'border-slate-100';
    };

    return (
        <div className="w-full py-4">
            <div className="flex items-center justify-between max-w-md mx-auto relative">
                {/* Step Lines */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                <div
                    className={cn(
                        "absolute top-1/2 left-0 h-0.5 transition-all duration-500 -translate-y-1/2 z-0",
                        type === 'solar' && "bg-solar-500",
                        type === 'wind' && "bg-wind-500",
                        type === 'storage' && "bg-storage-500"
                    )}
                    style={{ width: `${((Math.min(currentStep, steps.length) - 1) / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step) => (
                    <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                        <div
                            className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 shadow-sm",
                                getColorClass(step.id),
                                step.id === currentStep && "ring-4 ring-white"
                            )}
                        >
                            {step.id < currentStep ? (
                                <Check className="w-5 h-5" />
                            ) : (
                                step.id
                            )}
                        </div>
                        <span className={cn(
                            "text-xs font-bold whitespace-nowrap",
                            step.id === currentStep ? "text-slate-900" : "text-slate-400"
                        )}>
                            {step.name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
