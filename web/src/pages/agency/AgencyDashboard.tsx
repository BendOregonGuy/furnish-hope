/**
 * Caseworker landing page. Everything here comes from a single
 * /api/agency/dashboard call — one round trip, all agency-scoped on
 * the server so no cross-agency data can leak.
 *
 * Sections:
 *   - Welcome banner + "Refer a household" CTA
 *   - KPI row (this-month, total, open, delivered)
 *   - Two-column: Recent referrals | Activity feed
 *   - Request status breakdown (horizontal pills)
 *   - Team table (accepted caseworkers + pending invitations)
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api.ts';
import { useAuth } from '../../lib/auth.tsx';

interface RecentReferral {
  client_id: number;
  referral_date: string;
  client_name: string;
  client_type: string;
}
interface StatusBucket {
  status: string;
  count: number;
}
interface ActivityEvent {
  event_type: 'referral' | 'request' | 'delivery';
  event_at: string;
  client_id: number;
  client_name: string;
  label: string;
}
interface TeamRow {
  caseworker_id: number | null;
  full_name: string;
  email: string;
  status: 'active' | 'invited' | 'expired' | 'revoked';
  expires_at: string | null;
  referrals: number;
}
interface Dashboard {
  total_referrals: number;
  this_month_referrals: number;
  open_requests: number;
  delivered_requests: number;
  recent_referrals: RecentReferral[];
  status_breakdown: StatusBucket[];
  activity: ActivityEvent[];
  team: TeamRow[];
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

      {/* KPIs (4 cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Stat label="Referred this month"        value={data?.this_month_referrals ?? 0} loading={isLoading} />
        <Stat label="Total households referred"  value={data?.total_referrals ?? 0}      loading={isLoading} />
        <Stat label="Open requests"              value={data?.open_requests ?? 0}        loading={isLoading} accent="gold" />
        <Stat label="Delivered requests"         value={data?.delivered_requests ?? 0}   loading={isLoading} accent="sage" />
      </div>

      {/* Quick action */}
      <div className="card mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-display text-lg font-medium">Need to refer a household?</div>
          <div className="text-sm text-ink-soft">Fill out one form — Furnish Hope takes it from there.</div>
        </div>
        <Link to="/agency/referrals/new" className="btn-primary">+ Refer a household</Link>
      </div>

      {/* Request-status breakdown */}
      <div className="card mb-6">
        <div className="card-head px-0 pb-2">
          <h3 className="font-display font-medium text-[17px] m-0">Request status</h3>
          <span className="text-[11px] text-ink-faint">Across all your agency's requests</span>
        </div>
        {isLoading && <div className="text-sm text-ink-faint">Loading…</div>}
        {!isLoading && (!data?.status_breakdown || data.status_breakdown.length === 0) && (
          <div className="text-sm text-ink-faint italic">No requests yet.</div>
        )}
        {data?.status_breakdown && data.status_breakdown.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {data.status_breakdown.map(b => (
              <StatusPill key={b.status} status={b.status} count={b.count} />
            ))}
          </div>
        )}
      </div>

      {/* Two-column: recent + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Recent referrals */}
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

        {/* Activity feed */}
        <div className="card p-0 overflow-hidden">
          <div className="card-head px-4">
            <h3 className="font-display font-medium text-[17px] m-0">Recent activity</h3>
            <span className="text-[11px] text-ink-faint">Last 10 events</span>
          </div>
          {isLoading && <div className="px-4 py-3 text-sm text-ink-faint">Loading…</div>}
          {!isLoading && (!data?.activity || data.activity.length === 0) && (
            <div className="px-4 py-6 text-sm text-ink-faint italic text-center">
              Nothing yet. Activity here shows referrals, requests, and deliveries.
            </div>
          )}
          {data?.activity?.map((ev, i) => (
            <Link
              key={`${ev.event_type}-${ev.event_at}-${i}`}
              to={`/agency/referrals/${ev.client_id}`}
              className="block px-4 py-2 border-t border-hairline hover:bg-terracotta/[0.04]"
            >
              <div className="flex items-baseline gap-2">
                <EventDot type={ev.event_type} />
                <span className="font-medium text-sm">{ev.client_name}</span>
                <span className="text-[11px] text-ink-faint ml-auto whitespace-nowrap">{formatDate(ev.event_at)}</span>
              </div>
              <div className="text-[11px] text-ink-faint pl-4">{ev.label}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Team table */}
      <div className="card p-0 overflow-hidden">
        <div className="card-head px-4">
          <h3 className="font-display font-medium text-[17px] m-0">Team at {user?.agency_name ?? 'your agency'}</h3>
          <span className="text-[11px] text-ink-faint">Ask a Furnish Hope program manager to invite more.</span>
        </div>
        {isLoading && <div className="px-4 py-3 text-sm text-ink-faint">Loading…</div>}
        {!isLoading && (!data?.team || data.team.length === 0) && (
          <div className="px-4 py-6 text-sm text-ink-faint italic text-center">No caseworkers yet.</div>
        )}
        {data?.team && data.team.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-ink-faint">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Referrals</th>
                </tr>
              </thead>
              <tbody>
                {data.team.map((t, i) => (
                  <tr key={`${t.caseworker_id ?? 'inv'}-${i}`} className="border-t border-hairline">
                    <td className="px-4 py-2">{t.full_name}</td>
                    <td className="px-4 py-2 break-all text-ink-soft">{t.email}</td>
                    <td className="px-4 py-2"><TeamStatus row={t} /></td>
                    <td className="px-4 py-2 text-right text-ink-soft">{t.referrals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* --------------------------- KPI card --------------------------- */

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

/* --------------------------- Status pill (breakdown) --------------------------- */

function StatusPill({ status, count }: { status: string; count: number }) {
  // Colour-code by status. Everything unknown falls through to neutral.
  const map: Record<string, string> = {
    awaiting_review: 'bg-[#FDF3E7] text-[#6B4D1E]',
    in_progress:     'bg-terracotta-soft text-terracotta-deep',
    ready:           'bg-terracotta-soft text-terracotta-deep',
    delivered:       'bg-sage/20 text-sage',
    completed:       'bg-sage/20 text-sage',
    on_hold:         'bg-ink-faint/20 text-ink-soft',
    rejected:        'bg-terracotta-soft text-terracotta-deep',
  };
  const cls = map[status] ?? 'bg-cream-soft text-ink-soft';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium uppercase tracking-wide ${cls}`}>
      {prettyStatus(status)}
      <span className="opacity-70">·</span>
      <span>{count}</span>
    </span>
  );
}

/* --------------------------- Activity event dot --------------------------- */

function EventDot({ type }: { type: 'referral' | 'request' | 'delivery' }) {
  const map = {
    referral: 'bg-terracotta',
    request:  'bg-[#6B4D1E]',
    delivery: 'bg-sage',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[type]}`} aria-hidden />;
}

/* --------------------------- Team status pill --------------------------- */

function TeamStatus({ row }: { row: TeamRow }) {
  if (row.status === 'active') {
    return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-sage/20 text-sage">Active</span>;
  }
  if (row.status === 'invited') {
    const expiresLabel = row.expires_at
      ? ` · expires ${formatDate(row.expires_at)}`
      : '';
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-[#FDF3E7] text-[#6B4D1E]">
        Invited{expiresLabel}
      </span>
    );
  }
  if (row.status === 'expired') {
    return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-ink-faint/20 text-ink-soft">Expired</span>;
  }
  return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-ink-faint/20 text-ink-soft">Revoked</span>;
}

/* --------------------------- helpers --------------------------- */

function prettyStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(iso: string): string {
  const d = new Date(iso); if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
