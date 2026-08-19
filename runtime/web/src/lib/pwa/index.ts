'use client';

import { useEffect } from 'react';

export function usePWA() {
    useEffect(() => {
        // 注册Service Worker
        if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then((registration) => {
                        console.log('SW registered:', registration.scope);

                        // 检查更新
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            if (newWorker) {
                                newWorker.addEventListener('statechange', () => {
                                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                        // 有新版本可用
                                        if (confirm('发现新版本，是否刷新页面？')) {
                                            window.location.reload();
                                        }
                                    }
                                });
                            }
                        });
                    })
                    .catch((error) => {
                        console.error('SW registration failed:', error);
                    });
            });
        }
    }, []);
}

// PWA安装提示组件
export function PWAInstallPrompt() {
    useEffect(() => {
        let deferredPrompt: any;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;

            // 显示安装按钮（可以通过state控制）
            console.log('PWA install available');
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWA installed');
            deferredPrompt = null;
        });
    }, []);

    return null;
}

// 检查是否在PWA模式下运行
export function isPWA(): boolean {
    if (typeof window === 'undefined') return false;

    return window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
}

// 检查离线状态
export function useOnlineStatus() {
    const { useState, useEffect } = require('react');
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        setIsOnline(navigator.onLine);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}
