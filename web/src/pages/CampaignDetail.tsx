/**
 * Campaign detail — shows progress against goal, top donors,
 * all linked donations, pledges, and events.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, formatLongDate, formatMoney, formatShortDate } from '../lib/api.ts';
import { Loading, ErrorBox, StatusPill, Avatar } from '../components/ui.tsx';
import { DetailNavBar } from '../components/forms/FormNavBar.tsx';

interface Detail {
  campaign: any;
  totals: {
    raised: number | string;
    gift_count: number;
    total_pledged: number | string;
    pledged_fulfilled: number | string;
    outstanding_pledged: number | string;
  };
  donations: any[];
  pledges: any[];
  events: any[];
  topDonors: Array<{ donor_id: number; donor_name: string; total: number | string; gift_count: number }>;
  prevId: number | null;
  nextId: number | null;
}

export function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<Detail>({
    queryKey: ['campaign', id],
    queryFn: () => apiGet(`/api/campaigns/${id}`),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      navigate('/campaigns');
    },
    onError: (err: any) => window.alert(err.message ?? 'Delete failed'),
  });

  function handleDelete() {
    if (window.confirm('Permanently delete this campaign? Cancel it instead if there are any linked records.')) {
      deleteMut.mutate();
    }
  }

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const c = data.campaign;
  const t = data.totals;
  const goal = Number(c.goal_amount ?? 0);
  const raised = Number(t.raised);
  const outstanding = Number(t.outstanding_pledged);
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  const projectedPct = goal > 0 ? Math.min(100, Math.round(((raised + outstanding) / goal) * 100)) : 0;

  return (
    <>
      <DetailNavBar
        listLabel="campaigns" singularLabel="campaign" basePath="/campaigns"
        prevId={data.prevId} nextId={data.nextId}
        actions={
          <>
            <Link to="/campaigns/new" className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta">
              + New campaign
            </Link>
            <Link to={`/campaigns/${id}/edit`} className="btn-primary text-xs py-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </Link>
          </>
        }
      />

      {/* Header */}
      <div className="p-5 bg-cream border border-hairline rounded-[10px] mb-6">
        <div className="flex items-baseline gap-3.5 mb-1 flex-wrap">
          <div className="font-display text-2xl font-medium">{c.campaign_name}</div>
          <span className="pill pill-terra">{c.campaign_type}</span>
          <StatusPill status={c.campaign_status} />
          {c.fund_name && <span className="pill pill-muted">{c.fund_name}</span>}
        </div>
        <div className="flex gap-4 text-sm text-ink-soft flex-wrap">
          {c.start_date && <span>{formatLongDate(c.start_date)}{c.end_date && ` → ${formatLongDate(c.end_date)}`}</span>}
          {c.manager_name && <><span>·</span><span>Managed by {c.manager_name}</span></>}
          {c.public_url && <><span>·</span><a href={c.public_url} target="_blank" rel="noopener noreferrer" className="text-terracotta underline">Public page →</a></>}
        </div>
      </div>

      {/* Progress */}
      <div className="card mb-5">
        <div className="grid grid-cols-4 gap-5 mb-3">
          <Stat label="Raised" value={formatMoney(raised)} />
          <Stat label="Gifts" value={String(t.gift_count)} />
          <Stat label="Outstanding pledged" value={formatMoney(outstanding)} />
          <Stat label="Goal" value={goal > 0 ? formatMoney(goal) : '—'} />
        </div>
        {goal > 0 && (
          <>
            <div className="flex justify-between text-[11px] text-ink-faint mb-1">
              <span>Progress</span>
              <span>{pct}% raised{outstanding > 0 && ` · ${projectedPct}% projected w/ pledges`}</span>
            </div>
            <div className="w-full h-3 bg-cream-deep rounded-full overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 bg-gold-soft" style={{ width: `${projectedPct}%` }} />
              <div className="absolute inset-y-0 left-0 bg-sage transition-all" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-5">
        <div className="space-y-4">
          {/* Donations */}
          <div className="card">
            <div className="card-head">
              <h3 className="font-display font-medium text-[17px] m-0">Donations ({data.donations.length})</h3>
              <Link to={`/donations?campaign_id=${c.campaign_id}`} className="text-xs text-terracotta hover:text-terracotta-deep">
                View in donations →
              </Link>
            </div>
            {data.donations.length === 0 ? (
              <div className="text-sm text-ink-faint italic">No donations yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>Date</Th><Th>Donor</Th><Th>Type</Th><Th>Receipt</Th><Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.donations.slice(0, 20).map((d: any) => (
                    <tr key={d.donation_id} className="border-t border-hairline">
                      <td className="py-2 pr-3 text-xs">
                        <Link to={`/donations/${d.donation_id}`} className="text-terracotta font-medium">
                          {formatShortDate(d.donation_date)}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{d.donor_name}</td>
                      <td className="py-2 pr-3 text-xs">{d.donation_type}</td>
                      <td className="py-2 pr-3 text-xs font-mono">{d.receipt_number ?? <span className="text-ink-faint">—</span>}</td>
                      <td className="py-2 text-right font-display font-medium">{formatMoney(d.total_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pledges */}
          {data.pledges.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3 className="font-display font-medium text-[17px] m-0">Pledges ({data.pledges.length})</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>Date</Th><Th>Donor</Th><Th className="text-right">Pledged</Th><Th className="text-right">Outstanding</Th><Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.pledges.map((p: any) => (
                    <tr key={p.pledge_id} className="border-t border-hairline">
                      <td className="py-2 pr-3 text-xs">
                        <Link to={`/pledges/${p.pledge_id}`} className="text-terracotta font-medium">
                          {formatShortDate(p.pledge_date)}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{p.donor_name}</td>
                      <td className="py-2 text-right font-display font-medium">{formatMoney(p.total_pledged_amount)}</td>
                      <td className="py-2 text-right text-xs">{formatMoney(p.outstanding)}</td>
                      <td className="py-2"><StatusPill status={p.pledge_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Events */}
          {data.events.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3 className="font-display font-medium text-[17px] m-0">Events ({data.events.length})</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>Date</Th><Th>Event</Th><Th>Type</Th><Th className="text-right">Raised</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((e: any) => (
                    <tr key={e.event_id} className="border-t border-hairline">
                      <td className="py-2 pr-3 text-xs">{formatShortDate(e.event_date)}</td>
                      <td className="py-2 pr-3">
                        <Link to={`/events/${e.event_id}`} className="text-terracotta font-medium">{e.event_name}</Link>
                      </td>
                      <td className="py-2 pr-3 text-xs">{e.event_type}</td>
                      <td className="py-2 text-right font-display font-medium">
                        {e.amount_raised != null ? formatMoney(e.amount_raised) : <span className="text-ink-faint">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Top donors */}
          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Top donors</h3>
            </div>
            {data.topDonors.length === 0 ? (
              <div className="text-xs text-ink-faint italic">No donors yet.</div>
            ) : (
              <div className="space-y-2">
                {data.topDonors.map((d, i) => (
                  <Link key={d.donor_id} to={`/donors/${d.donor_id}`} className="flex items-center gap-2 hover:bg-terracotta/[0.025] -mx-2 px-2 py-1.5 rounded">
                    <div className="w-5 text-[10px] text-ink-faint font-medium">#{i + 1}</div>
                    <Avatar name={d.donor_name} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{d.donor_name}</div>
                      <div className="text-[10px] text-ink-faint">{d.gift_count} gift{d.gift_count === 1 ? '' : 's'}</div>
                    </div>
                    <div className="font-display font-medium text-xs">{formatMoney(d.total)}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {c.notes && (
            <div className="card">
              <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
                <h3 className="font-display font-medium text-sm m-0">Notes</h3>
              </div>
              <div className="text-sm text-ink-soft whitespace-pre-line">{c.notes}</div>
            </div>
          )}

          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Quick actions</h3>
            </div>
            <Link to={`/donations/new?campaign_id=${c.campaign_id}`} className="block text-xs text-ink-soft hover:text-terracotta py-1.5">
              + Record a donation to this campaign →
            </Link>
            <Link to={`/events/new?campaign_id=${c.campaign_id}`} className="block text-xs text-ink-soft hover:text-terracotta py-1.5">
              + Schedule an event for this campaign →
            </Link>
          </div>

          <button onClick={handleDelete} disabled={deleteMut.isPending}
            className="text-xs text-terracotta hover:text-terracotta-deep disabled:opacity-50 self-start">
            {deleteMut.isPending ? 'Deleting…' : 'Delete this campaign'}
          </button>
        </div>
      </div>
    </>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2 ${className}`}>{children}</th>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium">{label}</div>
      <div className="font-display text-2xl font-medium leading-none mt-1">{value}</div>
    </div>
  );
}
