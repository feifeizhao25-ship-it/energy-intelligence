'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { X, Award } from 'lucide-react';
import { useTranslations } from 'next-intl';

const MILESTONE_STORAGE_KEY = 'xinnengyuan_milestone_shown';

export function MilestoneModal() {
    const t = useTranslations('Welcome');
    const [isOpen, setIsOpen] = useState(false);
    const [showContent, setShowContent] = useState(false);

    // 关闭弹窗并记住状态
    const handleClose = useCallback(() => {
        setIsOpen(false);
        // 将关闭状态保存到 localStorage
        try {
            localStorage.setItem(MILESTONE_STORAGE_KEY, 'true');
        } catch (e) {
            console.warn('无法保存里程碑状态到 localStorage');
        }
    }, []);

    // 检查是否应该显示里程碑弹窗
    useEffect(() => {
        // 首先检查 localStorage，如果用户已经看过就不再显示
        try {
            const hasShown = localStorage.getItem(MILESTONE_STORAGE_KEY);
            if (hasShown === 'true') {
                return; // 用户已经看过，不再显示
            }
        } catch (e) {
            // localStorage 不可用时忽略错误
        }

        // 只在首次访问时显示欢迎弹窗
        const showDemo = setTimeout(() => {
            setShowContent(true);
            setIsOpen(true);

            // 触发礼花
            const duration = 3 * 1000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

            const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

            const interval = setInterval(function () {
                const timeLeft = animationEnd - Date.now();

                if (timeLeft <= 0) {
                    return clearInterval(interval);
                }

                const particleCount = 50 * (timeLeft / duration);

                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
            }, 250);

        }, 3000); // 3秒后显示欢迎弹窗

        return () => clearTimeout(showDemo);
    }, []);

    if (!isOpen || !showContent) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="bg-white rounded-3xl p-8 max-w-sm w-full relative overflow-hidden text-center shadow-2xl"
                >
                    {/* Background decoration */}
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-yellow-400 to-orange-500 opacity-10" />

                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 bg-black/5 rounded-full hover:bg-black/10 transition-colors z-10"
                    >
                        <X className="w-4 h-4 text-slate-500" />
                    </button>

                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/30">
                            <Award className="w-10 h-10 text-white" />
                        </div>

                        <div className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold mb-4 border border-orange-200">
                            {t('badge')}
                        </div>

                        <h3 className="text-2xl font-black text-slate-900 mb-3">
                            {t('title')}
                        </h3>

                        <p className="text-slate-500 text-sm leading-relaxed mb-8">
                            {t('description')}
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={handleClose}
                                className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
                            >
                                {t('explore')}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
