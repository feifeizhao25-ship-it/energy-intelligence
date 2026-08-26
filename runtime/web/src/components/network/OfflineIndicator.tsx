'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

// 网络状态检测 Hook
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(true);
    const [isSlowConnection, setIsSlowConnection] = useState(false);

    useEffect(() => {
        // 初始状态
        if (typeof navigator !== 'undefined') {
            setIsOnline(navigator.onLine);
        }

        const updateOnlineStatus = () => setIsOnline(navigator.onLine);

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        // 检测慢速网络
        if (typeof navigator !== 'undefined' && 'connection' in navigator) {
            const connection = (navigator as any).connection;
            const checkSpeed = () => {
                if (connection) {
                    setIsSlowConnection(
                        connection.effectiveType === '2g' ||
                        connection.effectiveType === 'slow-2g'
                    );
                }
            };

            if (connection) {
                connection.addEventListener('change', checkSpeed);
                checkSpeed();
            }
        }

        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, []);

    return { isOnline, isSlowConnection };
}

// 离线提示组件
export function OfflineIndicator() {
    const { isOnline, isSlowConnection } = useNetworkStatus();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Only show if offline or slow
        setIsVisible(!isOnline || isSlowConnection);
    }, [isOnline, isSlowConnection]);

    if (!isVisible) return null;

    return (
        <div className={`fixed bottom-24 left-4 right-4 md:left-auto md:right-24 md:w-80 z-50 p-4 rounded-xl shadow-lg border backdrop-blur-sm transition-all duration-300 ${!isOnline ? 'bg-red-500/90 border-red-400' : 'bg-yellow-500/90 border-yellow-400'
            } text-white`}>
            <div className="flex items-center gap-3">
                {!isOnline ? (
                    <WifiOff className="w-5 h-5 flex-shrink-0" />
                ) : (
                    <Wifi className="w-5 h-5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">
                        {!isOnline ? '网络已断开' : '网络质量较差'}
                    </p>
                    <p className="text-xs opacity-90 truncate">
                        {!isOnline
                            ? '请检查您的网络连接'
                            : '页面加载可能需要更长时间'}
                    </p>
                </div>
                {!isOnline && (
                    <button
                        onClick={() => window.location.reload()}
                        className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                )}
                <button
                    onClick={() => setIsVisible(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors text-xs"
                >
                    忽略
                </button>
            </div>
        </div>
    );
}
