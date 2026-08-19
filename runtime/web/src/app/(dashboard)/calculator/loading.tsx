'use client';

import { CardSkeleton } from '@/components/ui/Skeleton';

export default function CalculatorLoading() {
    return (
        <div className="min-h-screen bg-[#0f172a] p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header skeleton */}
                <div className="text-center mb-16">
                    <div className="h-6 w-48 bg-slate-700 rounded-full mx-auto mb-6 animate-pulse" />
                    <div className="h-14 w-96 bg-slate-700 rounded-xl mx-auto mb-4 animate-pulse" />
                    <div className="h-6 w-80 bg-slate-800 rounded-lg mx-auto animate-pulse" />
                </div>

                {/* Calculator cards skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-8 rounded-3xl bg-slate-800/40 border border-slate-700/50">
                            <div className="flex justify-between mb-6">
                                <div className="w-14 h-14 bg-slate-700 rounded-2xl animate-pulse" />
                                <div className="w-16 h-6 bg-slate-700 rounded-md animate-pulse" />
                            </div>
                            <div className="h-8 w-2/3 bg-slate-700 rounded-lg mb-3 animate-pulse" />
                            <div className="h-4 w-full bg-slate-800 rounded mb-2 animate-pulse" />
                            <div className="h-4 w-3/4 bg-slate-800 rounded mb-8 animate-pulse" />
                            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-700/50">
                                <div>
                                    <div className="h-3 w-16 bg-slate-700 rounded mb-2 animate-pulse" />
                                    <div className="h-6 w-12 bg-slate-600 rounded animate-pulse" />
                                </div>
                                <div>
                                    <div className="h-3 w-16 bg-slate-700 rounded mb-2 animate-pulse" />
                                    <div className="h-6 w-12 bg-slate-600 rounded animate-pulse" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
