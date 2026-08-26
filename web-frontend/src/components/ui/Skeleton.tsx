'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    width?: string | number;
    height?: string | number;
    animation?: 'pulse' | 'shimmer' | 'none';
}

export default function Skeleton({
    className,
    variant = 'rectangular',
    width,
    height,
    animation = 'shimmer',
}: SkeletonProps) {
    const baseClasses = 'bg-slate-200 relative overflow-hidden';

    const variantClasses = {
        text: 'rounded h-4',
        circular: 'rounded-full',
        rectangular: '',
        rounded: 'rounded-xl',
    };

    const animationClasses = {
        pulse: 'animate-pulse',
        shimmer: 'skeleton-shimmer',
        none: '',
    };

    const style: React.CSSProperties = {
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
    };

    return (
        <div
            className={cn(
                baseClasses,
                variantClasses[variant],
                animationClasses[animation],
                className
            )}
            style={style}
        >
            {animation === 'shimmer' && (
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer" />
            )}
        </div>
    );
}

// Pre-built skeleton patterns
export function CardSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn('bg-white rounded-2xl p-6 border border-slate-100', className)}>
            <div className="flex items-center gap-4 mb-4">
                <Skeleton variant="circular" width={48} height={48} />
                <div className="flex-1">
                    <Skeleton variant="text" className="w-2/3 mb-2" />
                    <Skeleton variant="text" className="w-1/3 h-3" />
                </div>
            </div>
            <Skeleton variant="rounded" className="w-full h-24 mb-4" />
            <div className="flex gap-2">
                <Skeleton variant="rounded" className="w-20 h-8" />
                <Skeleton variant="rounded" className="w-20 h-8" />
            </div>
        </div>
    );
}

export function DashboardSkeleton() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <Skeleton variant="text" className="w-64 h-10 mb-2" />
                    <Skeleton variant="text" className="w-48 h-4" />
                </div>
                <Skeleton variant="rounded" className="w-40 h-12" />
            </div>

            {/* Quick Access Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} variant="rounded" className="h-48" />
                ))}
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
                <div className="space-y-8">
                    <Skeleton variant="rounded" className="h-48" />
                    <CardSkeleton />
                </div>
            </div>
        </div>
    );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-4">
            {[...Array(count)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <Skeleton variant="circular" width={40} height={40} />
                    <div className="flex-1">
                        <Skeleton variant="text" className="w-3/4 mb-2" />
                        <Skeleton variant="text" className="w-1/2 h-3" />
                    </div>
                    <Skeleton variant="rounded" width={60} height={24} />
                </div>
            ))}
        </div>
    );
}

export function ChartSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn('bg-white rounded-2xl p-6 border border-slate-100', className)}>
            <div className="flex justify-between items-center mb-6">
                <Skeleton variant="text" className="w-32 h-6" />
                <Skeleton variant="rounded" className="w-24 h-8" />
            </div>
            <div className="flex items-end gap-4 h-48">
                {[0.6, 0.8, 0.5, 0.9, 0.7, 0.85].map((h, i) => (
                    <Skeleton
                        key={i}
                        variant="rounded"
                        className="flex-1"
                        height={`${h * 100}%`}
                    />
                ))}
            </div>
        </div>
    );
}
