'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale, defaultLocale, locales, t as translate } from './translations';

interface I18nContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string, params?: Record<string, any>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(defaultLocale);

    useEffect(() => {
        // 从localStorage读取语言偏好
        const saved = localStorage.getItem('locale') as Locale;
        if (saved && locales.includes(saved)) {
            setLocaleState(saved);
        } else {
            // 检测浏览器语言
            const browserLang = navigator.language;
            if (browserLang.startsWith('en')) {
                setLocaleState('en-US');
            }
        }
    }, []);

    const setLocale = (newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem('locale', newLocale);
        // 更新html lang属性
        document.documentElement.lang = newLocale;
    };

    const t = (key: string, params?: Record<string, any>) => {
        return translate(key, locale, params);
    };

    return (
        <I18nContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within I18nProvider');
    }
    return context;
}

// 语言切换器组件
export function LanguageSwitcher({ className }: { className?: string }) {
    const { locale, setLocale } = useI18n();

    return (
        <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className={`bg-transparent border border-slate-600 rounded-lg px-2 py-1 text-sm ${className || ''}`}
        >
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
        </select>
    );
}
