'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { displayedRole, isKnownRole } from '@/lib/dashboard/visible-role';

interface RolePreferenceValue {
    role: string | null;
    ready: boolean;
    selectRole: (next: string) => void;
}

const RolePreferenceContext = createContext<RolePreferenceValue>({
    role: null,
    ready: false,
    selectRole: () => undefined,
});

export function useRolePreference() {
    return useContext(RolePreferenceContext);
}

/** 顶栏下拉和首页共用：先看地址栏，再看已保存的角色。 */
export function RolePreferenceProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [urlRole, setUrlRole] = useState<string | null>(null);
    const [savedRole, setSavedRole] = useState<string | null>(null);
    const [picked, setPicked] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const fromUrl = new URLSearchParams(window.location.search).get('role');
        if (isKnownRole(fromUrl)) setUrlRole(fromUrl);
        let cancelled = false;
        fetch('/api/user/preferences', { cache: 'no-store' })
            .then((response) => (response.ok ? response.json() : null))
            .then((body) => {
                if (cancelled || !body) return;
                const saved = body?.savedRole ?? body?.preferences?.role ?? body?.profile?.role ?? null;
                setSavedRole(typeof saved === 'string' ? saved : null);
            })
            .catch(() => undefined)
            .finally(() => {
                if (!cancelled) setReady(true);
            });
        return () => { cancelled = true; };
    }, []);

    const resolved = picked ?? displayedRole(urlRole, savedRole);
    const role = resolved ?? (ready ? 'ci_owner' : null);

    function selectRole(next: string) {
        if (!isKnownRole(next)) return;
        setPicked(next);
        setUrlRole(next);
        router.push(`/?role=${encodeURIComponent(next)}`);
    }

    return (
        <RolePreferenceContext.Provider value={{ role, ready, selectRole }}>
            {children}
        </RolePreferenceContext.Provider>
    );
}
