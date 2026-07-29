'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { AuthContext } from '@/stores/auth-store';
import type { User } from '@/types';
import { userApi } from '@/lib/api';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    userApi
      .me()
      .then((res) => {
        if (res.success && res.data?.user) {
          setUserState(normalizeUser(res.data.user as any));
        }
      })
      .catch(() => {
        localStorage.removeItem('auth_token');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback((u: User, token: string) => {
    localStorage.setItem('auth_token', token);
    setUserState(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setUserState(null);
    window.location.href = '/login';
  }, []);

  const setUser = useCallback((u: User) => setUserState(u), []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

function normalizeUser(apiUser: Record<string, unknown>): User {
  return {
    id: String(apiUser.id ?? ''),
    name: String(apiUser.name ?? ''),
    email: String(apiUser.email ?? ''),
    phone: apiUser.phone ? String(apiUser.phone) : undefined,
    role: (apiUser.role as User['role']) || 'developer',
    company: apiUser.company ? String(apiUser.company) : undefined,
    country: apiUser.country ? String(apiUser.country) : undefined,
    timezone: String(apiUser.timezone ?? 'UTC'),
    language: String(apiUser.language ?? 'en'),
    currency: String(apiUser.currency ?? 'USD'),
    plan: (apiUser.plan as User['plan']) || 'free',
    avatarUrl: apiUser.avatar ? String(apiUser.avatar) : undefined,
    createdAt: String(apiUser.createdAt ?? new Date().toISOString()),
    gdprConsent: Boolean(apiUser.gdprConsent ?? false),
    marketingConsent: Boolean(apiUser.marketingConsent ?? false),
  };
}
