'use client';

import React from 'react';
import { MapPin, Sun, Wind, Battery, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationHeaderProps {
    city: string;
    resourceLevel: string;
    type: 'solar' | 'wind' | 'storage' | 'compare';
}

export default function LocationHeader({ city, resourceLevel, type }: LocationHeaderProps) {
    const getIcon = () => {
        switch (type) {
            case 'solar': return <Sun className="w-5 h-5 text-solar-500" />;
            case 'wind': return <Wind className="w-5 h-5 text-wind-500" />;
            case 'storage': return <Battery className="w-5 h-5 text-storage-500" />;
            case 'compare': return <RefreshCw className="w-5 h-5 text-indigo-500" />;
        }
    };

    const getLabel = () => {
        switch (type) {
            case 'solar': return "太阳能资源";
            case 'wind': return "风能资源";
            case 'storage': return "峰谷价差";
            case 'compare': return "综合评估";
        }
    };

    const getBgClass = () => {
        switch (type) {
            case 'solar': return "bg-solar-50 text-solar-700 border-solar-100";
            case 'wind': return "bg-wind-50 text-wind-700 border-wind-100";
            case 'storage': return "bg-storage-50 text-storage-700 border-storage-100";
            default: return "bg-slate-50 text-slate-700 border-slate-100";
        }
    };

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-slate-700">{city}</span>
                <button className="text-xs text-blue-600 hover:underline font-medium ml-2">更换</button>
            </div>

            <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-2xl border font-bold text-sm",
                getBgClass()
            )}>
                {getIcon()}
                <span>{getLabel()}：{resourceLevel}</span>
            </div>
        </div>
    );
}
