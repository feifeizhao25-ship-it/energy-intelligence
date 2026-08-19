'use client';

import { useState } from 'react';
import { Eye, Type, Minus, Plus, X, Accessibility } from 'lucide-react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { motion, AnimatePresence } from 'framer-motion';

export function AccessibilityPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const {
        isSeniorMode,
        toggleSeniorMode,
        fontSize,
        setFontSize,
        highContrast,
        toggleHighContrast
    } = useAccessibility();

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-24 right-4 md:right-auto md:left-4 z-40 bg-slate-900 text-white p-3 rounded-full shadow-lg hover:bg-slate-800 transition-colors"
                title="无障碍设置"
            >
                <Accessibility className="w-6 h-6" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed bottom-40 right-4 md:right-auto md:left-4 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <Accessibility className="w-5 h-5 text-indigo-600" />
                                关怀模式
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Senior Mode Toggle */}
                            <div
                                onClick={toggleSeniorMode}
                                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${isSeniorMode
                                        ? 'border-indigo-600 bg-indigo-50'
                                        : 'border-slate-100 hover:border-indigo-200'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-900">长辈模式</span>
                                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isSeniorMode ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isSeniorMode ? 'translate-x-4' : ''}`} />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500">
                                    开启大字号和高对比度，更适合长辈浏览
                                </p>
                            </div>

                            <div className="h-px bg-slate-100" />

                            {/* Font Size Control */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-2 block flex items-center gap-2">
                                    <Type className="w-3 h-3" />
                                    字体大小
                                </label>
                                <div className="flex bg-slate-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setFontSize('normal')}
                                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${fontSize === 'normal' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                                    >
                                        标准
                                    </button>
                                    <button
                                        onClick={() => setFontSize('large')}
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${fontSize === 'large' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                                    >
                                        较大
                                    </button>
                                    <button
                                        onClick={() => setFontSize('extra-large')}
                                        className={`flex-1 py-1.5 text-base font-bold rounded-md transition-all ${fontSize === 'extra-large' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                                    >
                                        超大
                                    </button>
                                </div>
                            </div>

                            {/* Contrast Control */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    <Eye className="w-4 h-4" />
                                    高对比度
                                </span>
                                <button
                                    onClick={toggleHighContrast}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${highContrast
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white text-slate-900 border-slate-200'
                                        }`}
                                >
                                    {highContrast ? '已开启' : '开启'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
