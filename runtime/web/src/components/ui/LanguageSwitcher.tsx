'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Languages, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LanguageSwitcher() {
    const locale = useLocale();
    const [isChanging, setIsChanging] = useState(false);

    const toggleLanguage = () => {
        const nextLocale = locale === 'zh' ? 'en' : 'zh';
        setIsChanging(true);

        // next-intl 使用 NEXT_LOCALE cookie
        document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;

        // 强制刷新页面以应用新语言
        setTimeout(() => {
            window.location.reload();
        }, 100);
    };

    return (
        <button
            onClick={toggleLanguage}
            disabled={isChanging}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                isChanging
                    ? "bg-green-50 border-green-500 text-green-600"
                    : "text-slate-600 hover:text-green-600 hover:bg-green-50 border-slate-200 hover:border-green-300"
            )}
            title={locale === 'zh' ? 'Switch to English' : '切换到中文'}
        >
            {isChanging ? (
                <>
                    <Check className="w-4 h-4" />
                    <span>Switching...</span>
                </>
            ) : (
                <>
                    <Languages className="w-4 h-4" />
                    <span>{locale === 'zh' ? 'EN' : '中文'}</span>
                </>
            )}
        </button>
    );
}
