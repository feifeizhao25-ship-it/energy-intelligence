'use client';

import { FileQuestion, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';

// 通用的友好错误提示组件
export default function FriendlyError({
    title = '哎呀，出了一点小问题',
    description = '我们正在努力修复中，请稍后再试',
    retry,
}: {
    title?: string;
    description?: string;
    retry?: () => void;
}) {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 text-center">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
                <span className="text-4xl">😵</span>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">{description}</p>

            <div className="flex gap-4">
                {retry && (
                    <button
                        onClick={retry}
                        className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        重试一下
                    </button>
                )}
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                    <Home className="w-4 h-4" />
                    回首页
                </Link>
            </div>
        </div>
    );
}
