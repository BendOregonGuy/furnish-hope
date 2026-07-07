/**
 * Route guards. RequireAuth bounces unauthenticated users to /login;
 * RequireAdmin further restricts to is_admin=true users.
 */

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.tsx';
import { Loading } from './ui.tsx';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <ForbiddenScreen />;
  return <>{children}</>;
}

export function RequireDeveloper({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin || !user.is_developer) return <ForbiddenScreen />;
  return <>{children}</>;
}

/** Program Manager route guard — admin implicitly qualifies. */
export function RequireProgramManager({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin && !user.is_program_manager) return <ForbiddenScreen />;
  return <>{children}</>;
}

function ForbiddenScreen() {
  return (
    <div className="p-10 max-w-lg mx-auto">
      <div className="card text-center">
        <div className="font-display text-2xl mb-2">Admins only</div>
        <div className="text-sm text-ink-soft mb-5">
          This area is restricted to administrators. If you need access, ask an
          admin to flip the switch on your account.
        </div>
        <a href="/" className="btn-ghost inline-flex">← Back to dashboard</a>
      </div>
    </div>
  );
}
