'use client';

import React, { useState } from 'react';
import {
    Calendar,
    Zap,
    DollarSign,
    Cloud,
    Sun,
    CloudRain,
    Wind,
    Check,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StationDataInputProps {
    stationId: string;
    stationType: 'solar' | 'wind' | 'storage';
    onSubmit: (data: StationRecordInput) => Promise<void>;
    onCancel: () => void;
}

export interface StationRecordInput {
    date: string;
    generation: number;        // kWh
    revenue?: number;          // 元
    weather?: 'sunny' | 'cloudy' | 'rainy' | 'windy';
    peakHours?: number;        // 峰值发电小时数
    notes?: string;
}

const weatherOptions = [
    { value: 'sunny', label: '晴天', icon: Sun, color: 'text-amber-500' },
    { value: 'cloudy', label: '多云', icon: Cloud, color: 'text-slate-400' },
    { value: 'rainy', label: '雨天', icon: CloudRain, color: 'text-blue-500' },
    { value: 'windy', label: '大风', icon: Wind, color: 'text-cyan-500' },
];

export default function StationDataInput({
    stationId,
    stationType,
    onSubmit,
    onCancel
}: StationDataInputProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<StationRecordInput>({
        date: new Date().toISOString().split('T')[0],
        generation: 0,
        revenue: 0,
        weather: 'sunny',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.generation <= 0) return;

        setLoading(true);
        try {
            await onSubmit(formData);
        } finally {
            setLoading(false);
        }
    };

    // 自动计算收益（简化逻辑）
    const estimatedRevenue = formData.generation * 0.85; // 假设平均电价0.85元

    return (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl text-slate-900">录入发电数据</h3>
                <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-xl">
                    <X className="w-5 h-5 text-slate-400" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Date */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        日期
                    </label>
                    <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary-500 outline-none font-medium"
                    />
                </div>

                {/* Generation */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        <Zap className="w-4 h-4 inline mr-1" />
                        发电量
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={formData.generation || ''}
                            onChange={(e) => setFormData({ ...formData, generation: Number(e.target.value) })}
                            placeholder="输入今日发电量"
                            min="0"
                            step="0.1"
                            className="w-full p-4 pr-16 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary-500 outline-none font-bold text-lg"
                            required
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                            kWh
                        </span>
                    </div>
                    {/* Quick Input Buttons */}
                    <div className="flex gap-2 mt-2">
                        {[50, 80, 100, 120, 150].map(val => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => setFormData({ ...formData, generation: val })}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-sm font-bold transition-all",
                                    formData.generation === val
                                        ? "bg-primary-500 text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                )}
                            >
                                {val}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Revenue (Optional) */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        <DollarSign className="w-4 h-4 inline mr-1" />
                        收益（可选）
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={formData.revenue || ''}
                            onChange={(e) => setFormData({ ...formData, revenue: Number(e.target.value) })}
                            placeholder={`预估 ¥${estimatedRevenue.toFixed(0)}`}
                            min="0"
                            step="0.01"
                            className="w-full p-4 pr-12 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary-500 outline-none font-medium"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                            元
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        不填写则自动按预估电价计算
                    </p>
                </div>

                {/* Weather */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        天气情况
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {weatherOptions.map(option => {
                            const Icon = option.icon;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, weather: option.value as any })}
                                    className={cn(
                                        "p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1",
                                        formData.weather === option.value
                                            ? "border-primary-500 bg-primary-50"
                                            : "border-slate-100 hover:border-slate-300"
                                    )}
                                >
                                    <Icon className={cn("w-6 h-6", option.color)} />
                                    <span className="text-xs font-bold text-slate-600">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        备注（可选）
                    </label>
                    <textarea
                        value={formData.notes || ''}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="记录特殊情况，如设备维护、遮挡等..."
                        rows={2}
                        className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary-500 outline-none font-medium resize-none"
                    />
                </div>

                {/* Summary Preview */}
                <div className="bg-primary-50 rounded-2xl p-4 border border-primary-100">
                    <div className="flex justify-between items-center">
                        <span className="text-primary-700 font-medium">本次录入</span>
                        <div className="text-right">
                            <div className="text-2xl font-black text-primary-600">
                                {formData.generation.toLocaleString()} kWh
                            </div>
                            <div className="text-sm text-primary-500">
                                预估收益 ¥{(formData.revenue || estimatedRevenue).toFixed(0)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                    >
                        取消
                    </button>
                    <button
                        type="submit"
                        disabled={loading || formData.generation <= 0}
                        className={cn(
                            "flex-[2] py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                            formData.generation > 0
                                ? "bg-primary-500 text-white hover:bg-primary-600 shadow-primary"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        )}
                    >
                        {loading ? (
                            <span className="animate-spin">⏳</span>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                保存记录
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
