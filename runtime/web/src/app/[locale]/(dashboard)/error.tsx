'use client';

import { useEffect } from 'react';
import FriendlyError from '@/components/ui/FriendlyError';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <FriendlyError
            title="页面遇到了一点故障"
            description="可能是网络波动或服务器暂时繁忙，别担心，您的数据很安全。"
            retry={reset}
        />
    );
}
