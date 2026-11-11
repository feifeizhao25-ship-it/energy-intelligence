'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

/** 与注销账号成功后的退出相同：next-auth signOut 清掉会话。 */
export function clearLoginSession() {
    return signOut({ callbackUrl: '/' });
}

export function UserAccountMenu({ name, planLabel }: { name: string; planLabel: string }) {
    const label = name.trim() || '用户';
    return (
        <div role="menu" aria-label="用户菜单" className="rounded-lg border border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-surface-dark">
            <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-lg shadow-primary/20">
                    {label[0] || 'U'}
                </div>
                <div className="flex min-w-0 flex-col overflow-hidden">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{label}</p>
                    <p className="truncate text-[10px] text-slate-500 dark:text-white/50">{planLabel}</p>
                </div>
            </div>
            <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 border-t border-slate-200 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                onClick={() => { void clearLoginSession(); }}
            >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                退出登录
            </button>
        </div>
    );
}
