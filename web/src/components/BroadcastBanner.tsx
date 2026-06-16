/**
 * Banner at the top of every page that surfaces active developer
 * broadcasts to the signed-in user. Polls every 60s. Each broadcast can
 * be dismissed per-user; "refresh_required" broadcasts also offer a
 * Refresh button that hard-reloads to pick up a new build.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';

interface Broadcast {
  broadcast_id: number;
  message: string;
  kind: 'info' | 'refresh_required' | 'warning';
  created_at: string;
  expires_at: string | null;
  related_issue_id: number | null;
  created_by_username: string | null;
}

export function BroadcastBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: broadcasts } = useQuery<Broadcast[]>({
    queryKey: ['broadcasts', 'active'],
    queryFn: () => apiGet('/api/broadcasts/active'),
    enabled: !!user,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const dismissMut = useMutation({
    mutationFn: (id: number) => apiPost(`/api/broadcasts/${id}/dismiss`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['broadcasts', 'active'] }),
  });

  if (!user || !broadcasts || broadcasts.length === 0) return null;

  return (
    <div className="space-y-1.5 mb-2">
      {broadcasts.map(b => {
        const isRefresh = b.kind === 'refresh_required';
        const isWarning = b.kind === 'warning';
        const cls = isRefresh
          ? 'bg-gold/15 border-gold/40 text-ink'
          : isWarning
            ? 'bg-terracotta-soft border-terracotta/40 text-terracotta-deep'
            : 'bg-sage-soft border-sage/40 text-[#3F4A33]';
        return (
          <div key={b.broadcast_id} className={`border ${cls} rounded-md px-4 py-2.5 flex items-start gap-3`}>
            <span className="text-base leading-none mt-0.5">
              {isRefresh ? '🔄' : isWarning ? '⚠' : 'ℹ'}
            </span>
            <div className="flex-1 text-sm whitespace-pre-wrap">
              {b.message}
              {b.created_by_username && (
                <span className="block text-[10px] text-ink-faint mt-0.5">
                  — {b.created_by_username}
                </span>
              )}
            </div>
            <div className="flex gap-2 items-center flex-shrink-0">
              {isRefresh && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="btn-primary text-xs py-1 px-2.5"
                  title="Reload the page to pick up the latest build"
                >Refresh now</button>
              )}
              <button
                type="button"
                onClick={() => dismissMut.mutate(b.broadcast_id)}
                disabled={dismissMut.isPending}
                className="text-ink-faint hover:text-ink text-xs px-1.5"
                title="Dismiss this notice"
              >×</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
