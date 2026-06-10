/**
 * Caseworker landing page. Shows their own agency's referral counts +
 * recent activity at a glance. NO internal Furnish Hope data.
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api.ts';
import { useAuth } from '../../lib/auth.tsx';

interface Dashboard {
  total_referrals: number;
  open_requests: number;
  delivered_requests: number;
  recent_referrals: Array<{
    client_id: number;
    referral_date: string;
    client_name: string;
    client_type: string;
  }>;
}

export function AgencyDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ['agency', 'dashboard'],
    queryFn: () => apiGet('/api/agency/dashboard'),
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-medium m-0">
          Welcome, {user?.display_name?.split(' ')[0] ?? 'there'}.
        </h1>
        <p className="text-sm text-ink-soft mt-1">
          Refer households from <strong>{user?.agency_name ?? 'your agency'}</strong> and follow their request status.
        </p>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Total households referred" value={data?.total_referrals ?? 0} loading={isLoading} />
        <Stat label="Open requests"             value={data?.open_requests ?? 0}   loading={isLoading} accent="gold" />
        <Stat label="Delivered requests"        value={data?.delivered_requests ?? 0} loading={isLoading} accent="sage" />
      </div>

      {/* Quick action */}
      <div className="card mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-display text-lg font-medium">Need to refer a household?</div>
          <div className="text-sm text-ink-soft">Fill out one form — Furnish Hope takes it from there.</div>
        </div>
        <Link to="/agency/referrals/new" className="btn-primary">+ Refer a household</Link>
      </div>

      {/* Recent */}
      <div className="card p-0 overflow-hidden">
        <div className="card-head px-4">
          <h3 className="font-display font-medium text-[17px] m-0">Recent referrals</h3>
          <Link to="/agency/referrals" className="text-xs text-terracotta hover:text-terracotta-deep">View all →</Link>
        </div>
        {isLoading && <div className="px-4 py-3 text-sm text-ink-faint">Loading…</div>}
        {!isLoading && (!data?.recent_referrals || data.recent_referrals.length === 0) && (
          <div className="px-4 py-6 text-sm text-ink-faint italic text-center">
            No referrals yet. Click "+ Refer a household" above to send your first one.
          </div>
        )}
        {data?.recent_referrals?.map(r => (
          <Link
            key={r.client_id}
            to={`/agency/referrals/${r.client_id}`}
            className="block px-4 py-2.5 border-t border-hairline hover:bg-terracotta/[0.04]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{r.client_name}</span>
              <span className="text-[11px] text-ink-faint whitespace-nowrap">{formatDate(r.referral_date)}</span>
            </div>
            <div className="text-[11px] text-ink-faint">{r.client_type}</div>
          </Link>
        ))}
      </div>
    </>
  );
}

function Stat({ label, value, loading, accent }: { label: string; value: number; loading: boolean; accent?: 'sage' | 'gold' }) {
  const numCls = accent === 'sage' ? 'text-sage' : accent === 'gold' ? 'text-[#6B4D1E]' : 'text-terracotta';
  return (
    <div className="card text-center">
      <div className={`font-display text-3xl font-medium ${numCls}`}>
        {loading ? '…' : value}
      </div>
      <div className="text-[11px] uppercase tracking-widest text-ink-faint font-medium mt-1">{label}</div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso); if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
