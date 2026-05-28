/**
 * Authentication context. `useAuth()` returns the current user + login /
 * logout / refresh helpers. The provider:
 *
 *  - Loads the current user from `/api/auth/me` on mount (and on demand).
 *  - Registers a session-lost handler with `api.ts` so any 401 from a
 *    later request snaps the UI back to /login.
 *  - Exposes `login(username, password)` and `logout()` that talk to the
 *    auth router.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, registerSessionLostHandler } from './api.ts';

export interface CurrentUser {
  user_account_id: number;
  username: string;
  is_admin: boolean;
  is_active: boolean;
  facility_staff_id: number | null;
  agency_contact_id: number | null;
  display_name: string;
}

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      const { user } = await apiGet<{ user: CurrentUser }>('/api/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run once on mount.
  useEffect(() => { void refresh(); }, [refresh]);

  // Hook up the 401 handler so background requests can boot us to /login.
  useEffect(() => {
    registerSessionLostHandler(() => {
      setUser(null);
      // Only navigate if we're not already on /login.
      if (window.location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    });
    return () => registerSessionLostHandler(null);
  }, [navigate]);

  const login = useCallback(async (username: string, password: string) => {
    const { user } = await apiPost<{ user: CurrentUser }>('/api/auth/login', { username, password });
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try { await apiPost('/api/auth/logout', {}); } catch { /* best-effort */ }
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>');
  return ctx;
}
