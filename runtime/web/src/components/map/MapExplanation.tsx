'use client';

import type { ReactNode } from 'react';

/**
 * 手机上地图说明默认收起，桌面样式在 globals.css 里把正文展开。
 * 正文只渲染一次，不删原有说明。
 */
export default function MapExplanation({ children }: { children: ReactNode }) {
    return (
        <details className="map-explanation rounded-2xl border border-[var(--line)] bg-white p-4 text-slate-800 md:rounded-none md:border-0 md:bg-transparent md:p-0">
            <summary className="cursor-pointer text-sm font-bold md:hidden">地图说明</summary>
            <div className="map-explanation-body mt-3 space-y-4 md:mt-0">{children}</div>
        </details>
    );
}
