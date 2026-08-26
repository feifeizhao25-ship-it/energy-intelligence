'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface UsageLimitToastProps {
    show: boolean;
    feature: string;
    remaining: number;
    limit: number;
    onClose: () => void;
    onUpgrade?: () => void;
}

export default function UsageLimitToast({
    show,
    feature,
    remaining,
    limit,
    onClose,
    onUpgrade,
}: UsageLimitToastProps) {
    const isExhausted = remaining <= 0;
    const isLow = remaining > 0 && remaining <= 2;

    useEffect(() => {
        if (show && !isExhausted) {
            const timer = setTimeout(onClose, 5000);
            return () => clearTimeout(timer);
        }
    }, [show, isExhausted, onClose]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className="fixed bottom-6 right-6 z-50 max-w-sm"
                >
                    <div
                        className={`rounded-2xl shadow-2xl overflow-hidden ${isExhausted
                                ? 'bg-gradient-to-r from-red-600 to-rose-600'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500'
                            }`}
                    >
                        <div className="p-4 text-white">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-white/20 rounded-xl">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm">
                                        {isExhausted
                                            ? `今日「${feature}」次数已用完`
                                            : `「${feature}」剩余 ${remaining} 次`}
                                    </h4>
                                    <p className="text-xs text-white/80 mt-1">
                                        {isExhausted
                                            ? '升级会员享受更高额度'
                                            : `每日限额 ${limit} 次，00:00 重置`}
                                    </p>

                                    {isExhausted && (
                                        <div className="mt-3 flex gap-2">
                                            {onUpgrade ? (
                                                <button
                                                    onClick={onUpgrade}
                                                    className="bg-white text-red-600 text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
                                                >
                                                    立即升级 <ArrowRight className="w-3 h-3" />
                                                </button>
                                            ) : (
                                                <Link
                                                    href="/pricing"
                                                    className="bg-white text-red-600 text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
                                                >
                                                    查看套餐 <ArrowRight className="w-3 h-3" />
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Progress bar showing usage */}
                        <div className="h-1 bg-white/20">
                            <div
                                className="h-full bg-white transition-all duration-300"
                                style={{ width: `${((limit - remaining) / limit) * 100}%` }}
                            />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// Hook for managing usage limit toasts
export function useUsageLimitToast() {
    const [toastState, setToastState] = useState<{
        show: boolean;
        feature: string;
        remaining: number;
        limit: number;
    }>({
        show: false,
        feature: '',
        remaining: 0,
        limit: 0,
    });

    const showLimitToast = (feature: string, remaining: number, limit: number) => {
        setToastState({ show: true, feature, remaining, limit });
    };

    const hideLimitToast = () => {
        setToastState((prev) => ({ ...prev, show: false }));
    };

    return {
        toastState,
        showLimitToast,
        hideLimitToast,
    };
}
