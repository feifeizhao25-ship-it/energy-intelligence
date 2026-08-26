'use client';

import React, { useRef, useState } from 'react';
import { Share2, Download, Copy, Check, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShareCardProps {
    energyType: 'solar' | 'wind' | 'storage';
    location: string;
    capacity: number;          // kW
    totalRevenue: number;      // 万元
    paybackYears: number;
    irr: number;              // %
    annualGeneration: number; // kWh
    projectYears?: number;
    shareUrl?: string;
}

const typeConfig = {
    solar: {
        icon: '☀️',
        name: '光伏发电',
        gradient: 'from-solar-400 to-solar-600',
        color: 'text-solar-600',
    },
    wind: {
        icon: '💨',
        name: '风力发电',
        gradient: 'from-wind-400 to-wind-600',
        color: 'text-wind-600',
    },
    storage: {
        icon: '🔋',
        name: '储能系统',
        gradient: 'from-storage-400 to-storage-600',
        color: 'text-storage-600',
    },
};

export default function ShareCard({
    energyType,
    location,
    capacity,
    totalRevenue,
    paybackYears,
    irr,
    annualGeneration,
    projectYears = 25,
    shareUrl = 'https://energy.ai',
}: ShareCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    const config = typeConfig[energyType];

    const handleCopyLink = async () => {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `我的${config.name}收益测算`,
                    text: `${projectYears}年预计收益 ¥${totalRevenue}万，投资回报率 ${irr}%`,
                    url: shareUrl,
                });
            } catch (err) {
                setShowShareModal(true);
            }
        } else {
            setShowShareModal(true);
        }
    };

    return (
        <>
            {/* Share Button */}
            <button
                onClick={handleShare}
                className="flex items-center gap-2 bg-white border-2 border-slate-100 px-6 py-3 rounded-2xl font-bold text-slate-700 hover:border-primary-300 hover:text-primary-600 transition-all shadow-sm"
            >
                <Share2 className="w-5 h-5" />
                分享收益
            </button>

            {/* Share Modal */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden animate-in fade-in scale-in duration-300">
                        {/* Card Preview */}
                        <div
                            ref={cardRef}
                            className="p-6"
                        >
                            {/* Card Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">{config.icon}</span>
                                    <span className="font-bold text-slate-900">{config.name}</span>
                                </div>
                                <span className="text-xs font-bold text-slate-400">新能源智库</span>
                            </div>

                            {/* Main Stats */}
                            <div className={cn("rounded-2xl p-6 text-white mb-4 bg-gradient-to-br", config.gradient)}>
                                <div className="text-sm opacity-80 mb-1">
                                    {location} · {capacity}kW
                                </div>
                                <div className="text-4xl font-black mb-1">
                                    ¥{totalRevenue}万
                                </div>
                                <div className="text-sm opacity-80">
                                    {projectYears}年总收益
                                </div>
                            </div>

                            {/* Key Metrics */}
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="bg-slate-50 rounded-xl p-3 text-center">
                                    <div className="text-xl font-black text-slate-900">{paybackYears}年</div>
                                    <div className="text-xs text-slate-500">回本时间</div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 text-center">
                                    <div className="text-xl font-black text-primary-600">{irr}%</div>
                                    <div className="text-xs text-slate-500">投资回报率</div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 text-center">
                                    <div className="text-xl font-black text-slate-900">{(annualGeneration / 1000).toFixed(1)}k</div>
                                    <div className="text-xs text-slate-500">年发电量</div>
                                </div>
                            </div>

                            {/* QR Code Placeholder */}
                            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                                <div className="text-sm text-slate-600">扫码测算你的收益</div>
                                <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                                    <QrCode className="w-8 h-8 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="border-t border-slate-100 p-4 bg-slate-50">
                            <div className="flex gap-3">
                                <button
                                    onClick={handleCopyLink}
                                    className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 py-3 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-4 h-4 text-primary-500" />
                                            已复制
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4" />
                                            复制链接
                                        </>
                                    )}
                                </button>
                                <button className="flex-1 flex items-center justify-center gap-2 bg-primary-500 text-white py-3 rounded-xl font-bold hover:bg-primary-600 transition-colors">
                                    <Download className="w-4 h-4" />
                                    保存图片
                                </button>
                            </div>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="w-full mt-3 py-2 text-slate-500 font-medium hover:text-slate-700"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
