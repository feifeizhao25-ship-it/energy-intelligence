'use client';

/**
 * auth-store — React context holding the signed-in user session.
 * The store is intentionally lightweight: AuthProvider owns the state and
 * token persistence; consumers read via useAuth().
 */

import { createContext, useContext } from 'react';
import type { User } from '@/types';

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  setUser: () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
