import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet, formatMoney, formatShortDate } from '../lib/api.ts';
import { PageHeader, StatusPill, Avatar, Loading, ErrorBox, AnonPill } from '../components/ui.tsx';
import { useAuth } from '../lib/auth.tsx';

type DashboardData = {
  metrics: {
    active_clients: number;
    open_requests: number;
    inventory_value: number;
    inventory_count: number;
    homes_furnished_ytd: number;
  };
  pendingRequests: Array<{
    request_id: number;
    client_id: number;
    client_name: string;
    client_type: string;
    agency_name: string | null;
    request_date: string;
    status: string;
  }>;
  recentDonations: Array<{
    donation_id: number;
    donation_date: string;
    total_value: number | null;
    donation_type: string;
    donor_name: string;
    is_anonymous: boolean;
    donor_type: string;
    item_count: number;
  }>;
  giving: {
    ytd_giving: number | string;
    ytd_gift_count: number;
    ytd_tax_deductible: number | string;
    outstanding_pledges: number | string;
  };
  byFundYtd: Array<{ fund_name: string; total: number | string }>;
  topDonorsYtd: Array<{ donor_id: number; donor_name: string; is_anonymous: boolean; ytd_total: number | string; gift_count: number }>;
  activeCampaigns: Array<{
    campaign_id: number; campaign_name: string; goal_amount: number | string | null;
    end_date: string | null; campaign_type: string; raised: number | string;
  }>;
  upcomingEvents: Array<{
    event_id: number; event_name: string; event_date: string; start_time: string | null;
    goal_amount: number | string | null; amount_raised: number | string | null;
    event_type: string; campaign_name: string | null; attendee_count: number;
  }>;
};

export function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => apiGet('/api/dashboard'),
  });

  // Admin-only: surface pending-duplicate count as a top-of-dashboard alert.
  // The Sidebar already polls this same endpoint at the same key, so React
  // Query will hand back the cached payload — no extra request.
  const { data: dupQ } = useQuery<unknown[]>({
    queryKey: ['duplicate-queue'],
    queryFn: () => apiGet('/api/admin/duplicates'),
    enabled: !!user?.is_admin,
    refetchInterval: 5 * 60_000,
  });
  const dupCount = dupQ?.length ?? 0;

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const firstName = (user?.display_name ?? user?.username ?? '').split(' ')[0] || 'there';
  const totalByFund = data.byFundYtd.reduce((s, f) => s + Number(f.total ?? 0), 0);
  const ytdGiving = Number(data.giving.ytd_giving);

  return (
    <>
      <PageHeader
        helpSection="dashboard"
        title={`${greeting()},`}
        emphasis={firstName}
        subtitle={`${data.metrics.open_requests} packing list${data.metrics.open_requests === 1 ? '' : 's'} awaiting review · ${formatMoney(data.giving.ytd_giving)} raised year-to-date.`}
        actions={
          <>
            <Link to="/donations/new" className="btn-ghost">+ New donation</Link>
            <Link to="/clients/new" className="btn-primary"><span className="text-base leading-none">+</span> New client</Link>
          </>
        }
      />

      {/* Admin-only alert: pending duplicate-client pairs from the nightly scan. */}
      {user?.is_admin && dupCount > 0 && (
        <div className="mb-5 p-3 bg-terracotta-soft border-l-4 border-terracotta rounded-r-md flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-medium text-terracotta-deep">
              {dupCount} potential duplicate client {dupCount === 1 ? 'pair is' : 'pairs are'} awaiting review.
            </span>
            <span className="text-ink-soft"> Resolve them to keep household records clean.</span>
          </div>
          <Link
            to="/admin/duplicate-clients"
            className="shrink-0 px-3 py-1.5 bg-terracotta text-paper text-sm rounded hover:bg-terracotta-deep whitespace-nowrap"
          >
            Review queue →
          </Link>
        </div>
      )}

      {/* Operations metrics */}
      <div className="grid grid-cols-4 gap-3.5 mb-5">
        <Metric label="Active Clients" value={data.metrics.active_clients} hint="" />
        <Metric label="Open Requests" value={data.metrics.open_requests} hint="" />
        <Metric label="Inventory Value" value={formatMoney(data.metrics.inventory_value)} hint={`${data.metrics.inventory_count} items across facilities`} />
        <Metric label="Homes Furnished YTD" value={data.metrics.homes_furnished_ytd} hint="" />
      </div>

      {/* Giving metrics */}
      <div className="grid grid-cols-4 gap-3.5 mb-7">
        <Metric
          label="YTD Donations"
          value={formatMoney(data.giving.ytd_giving)}
          hint={`${data.giving.ytd_gift_count} gift${data.giving.ytd_gift_count === 1 ? '' : 's'}`}
          accent
        />
        <Metric
          label="YTD Tax-Deductible"
          value={formatMoney(data.giving.ytd_tax_deductible)}
          hint="Receipt-ready amount"
          accent
        />
        <Metric
          label="Outstanding Pledges"
          value={formatMoney(data.giving.outstanding_pledges)}
          hint="Across active pledges"
          accent
        />
        <Metric
          label="Average Gift YTD"
          value={formatMoney(data.giving.ytd_gift_count > 0 ? ytdGiving / data.giving.ytd_gift_count : 0)}
          hint=""
          accent
        />
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-5">
        <div className="space-y-5">
          {/* Pending requests */}
          <div className="card">
            <div className="card-head">
              <h3 className="font-display font-medium text-[17px] m-0">Pending packing lists</h3>
              <Link to="/requests" className="text-xs text-terracotta font-medium">View all →</Link>
            </div>
            {data.pendingRequests.length === 0 ? (
              <div className="text-sm text-ink-faint py-4 italic">No pending requests.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Client</th>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Agency</th>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Request</th>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingRequests.map(r => (
                    <tr key={r.request_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                      <td className="py-2.5 pr-2">
                        <Link to={`/requests/${r.request_id}`} className="flex items-center gap-2.5">
                          <Avatar name={r.client_name} />
                          <div>
                            <div className="font-medium">{r.client_name}</div>
                            <div className="text-[11px] text-ink-faint">{r.client_type}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="py-2.5 pr-2">{r.agency_name ?? '—'}</td>
                      <td className="py-2.5 pr-2">{formatShortDate(r.request_date)}</td>
                      <td className="py-2.5"><StatusPill status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Active campaigns */}
          {data.activeCampaigns.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3 className="font-display font-medium text-[17px] m-0">Active campaigns</h3>
                <Link to="/campaigns" className="text-xs text-terracotta font-medium">All →</Link>
              </div>
              <div className="space-y-3">
                {data.activeCampaigns.map(c => {
                  const goal = Number(c.goal_amount ?? 0);
                  const raised = Number(c.raised);
                  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
                  return (
                    <Link key={c.campaign_id} to={`/campaigns/${c.campaign_id}`} className="block hover:bg-terracotta/[0.025] -mx-2 px-2 py-1.5 rounded">
                      <div className="flex justify-between items-baseline text-xs mb-1">
                        <span className="font-medium text-ink truncate pr-2">{c.campaign_name}</span>
                        <span className="text-ink-soft whitespace-nowrap">
                          {formatMoney(raised)}{goal > 0 && <span className="text-ink-faint"> / {formatMoney(goal)}</span>}
                        </span>
                      </div>
                      {goal > 0 && (
                        <div className="w-full h-1.5 bg-cream-deep rounded-full overflow-hidden">
                          <div className="h-full bg-sage" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      <div className="text-[10px] text-ink-faint mt-0.5">{c.campaign_type}{c.end_date && ` · ends ${formatShortDate(c.end_date)}`}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming events */}
          {data.upcomingEvents.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3 className="font-display font-medium text-[17px] m-0">Upcoming events</h3>
                <Link to="/events" className="text-xs text-terracotta font-medium">All →</Link>
              </div>
              <div className="space-y-2">
                {data.upcomingEvents.map(ev => (
                  <Link key={ev.event_id} to={`/events/${ev.event_id}`} className="flex items-baseline justify-between hover:bg-terracotta/[0.025] -mx-2 px-2 py-1.5 rounded">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{ev.event_name}</div>
                      <div className="text-[10px] text-ink-faint">
                        {ev.event_type}
                        {ev.campaign_name && ` · ${ev.campaign_name}`}
                        {` · ${ev.attendee_count} RSVP${ev.attendee_count === 1 ? '' : 's'}`}
                      </div>
                    </div>
                    <div className="text-xs text-ink-soft whitespace-nowrap ml-3">
                      {formatShortDate(ev.event_date)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* YTD revenue by fund */}
          <div className="card">
            <div className="card-head">
              <h3 className="font-display font-medium text-[17px] m-0">YTD revenue by fund</h3>
              <Link to="/donations" className="text-xs text-terracotta font-medium">All donations →</Link>
            </div>
            {data.byFundYtd.length === 0 ? (
              <div className="text-sm text-ink-faint py-4 italic">No designated donations this year.</div>
            ) : (
              <div className="space-y-2.5">
                {data.byFundYtd.map(f => {
                  const pct = totalByFund > 0 ? Math.round((Number(f.total) / totalByFund) * 100) : 0;
                  return (
                    <div key={f.fund_name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-ink font-medium">{f.fund_name}</span>
                        <span className="text-ink-soft">{formatMoney(f.total)} <span className="text-ink-faint">· {pct}%</span></span>
                      </div>
                      <div className="w-full h-2 bg-cream-deep rounded-full overflow-hidden">
                        <div className="h-full bg-terracotta transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {/* Top donors YTD */}
          <div className="card">
            <div className="card-head">
              <h3 className="font-display font-medium text-[17px] m-0">Top donors YTD</h3>
              <Link to="/donors" className="text-xs text-terracotta font-medium">All →</Link>
            </div>
            {data.topDonorsYtd.length === 0 ? (
              <div className="text-sm text-ink-faint py-4 italic">No gifts this year yet.</div>
            ) : (
              <div className="space-y-2.5">
                {data.topDonorsYtd.map((d, i) => (
                  <Link key={d.donor_id} to={`/donors/${d.donor_id}`} className="flex items-center gap-2.5 hover:bg-terracotta/[0.025] -mx-2 px-2 py-1.5 rounded">
                    <div className="w-5 text-[10px] text-ink-faint font-medium">#{i + 1}</div>
                    <Avatar name={d.donor_name} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-1.5">
                        <span className="truncate">{d.donor_name}</span>
                        {d.is_anonymous && <AnonPill />}
                      </div>
                      <div className="text-[11px] text-ink-faint">{d.gift_count} gift{d.gift_count === 1 ? '' : 's'}</div>
                    </div>
                    <div className="font-display font-medium text-sm">{formatMoney(d.ytd_total)}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent donations */}
          <div className="card">
            <div className="card-head">
              <h3 className="font-display font-medium text-[17px] m-0">Recent activity</h3>
              <Link to="/donations" className="text-xs text-terracotta font-medium">All →</Link>
            </div>
            {data.recentDonations.length === 0 ? (
              <div className="text-sm text-ink-faint py-4 italic">Nothing recent.</div>
            ) : (
              <div>
                {data.recentDonations.map(d => (
                  <div key={d.donation_id} className="grid grid-cols-[1.4fr_70px_80px] gap-3 py-2.5 border-b border-hairline last:border-0 items-center text-sm">
                    <div>
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        <Link to={`/donations/${d.donation_id}`} className="font-medium hover:text-terracotta">{d.donor_name}</Link>
                        {d.is_anonymous && <AnonPill />}
                      </span>
                      <div className="text-[11px] text-ink-faint">{d.donation_type} · {formatShortDate(d.donation_date)}</div>
                    </div>
                    <div className="text-xs text-ink-soft">{d.item_count > 0 ? `${d.item_count} item${d.item_count > 1 ? 's' : ''}` : '—'}</div>
                    <div className="text-right font-display font-medium">{formatMoney(d.total_value)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, hint, accent }: { label: string; value: number | string; hint?: string; accent?: boolean }) {
  return (
    <div className={`border rounded-[10px] px-4 pt-4 pb-4 ${accent ? 'bg-paper border-terracotta/20' : 'bg-cream border-hairline'}`}>
      <div className="text-[11px] tracking-widest uppercase text-ink-faint font-medium mb-3">{label}</div>
      <div className="font-display font-medium text-[32px] tracking-tight text-ink leading-none mb-1.5">{value}</div>
      {hint ? <div className="text-xs text-ink-soft">{hint}</div> : <div className="text-xs">&nbsp;</div>}
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
