'use client';

const PREFERENCE_KEY = 'nengjian-detail-open';

export function emptyNextStep(hasData: boolean): string {
    return hasData ? '' : '下一步：先选择省份，或打开一份已审核的政策原文。';
}

export function rememberDetailOpen(open: boolean) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PREFERENCE_KEY, open ? '1' : '0');
}

export function detailOpenPreference(): boolean {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(PREFERENCE_KEY) === '1';
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
    return (
        <div data-testid="empty-state" className="ei-empty">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">{detail || emptyNextStep(false)}</p>
        </div>
    );
}
