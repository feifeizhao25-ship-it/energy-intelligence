'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { AuthContext } from '@/stores/auth-store';
import type { User } from '@/types';
import { userApi } from '@/lib/api';
import { userFromPayload } from '@/lib/auth/session-user';

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
        const signedIn = userFromPayload(res);
        if (signedIn) setUserState(signedIn);
        else localStorage.removeItem('auth_token');
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
