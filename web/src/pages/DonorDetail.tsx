/**
 * Donor detail — comprehensive view of one donor with lifetime giving,
 * YTD totals, designation breakdown, outstanding pledges, and gift
 * history.
 */

import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiGet, formatLongDate, formatMoney, formatShortDate } from '../lib/api.ts';
import { Avatar, Loading, ErrorBox, StatusPill } from '../components/ui.tsx';
import { DetailNavBar } from '../components/forms/FormNavBar.tsx';

interface DonorDetailResponse {
  donor: any;
  totals: {
    lifetime_giving: number | string;
    lifetime_tax_deductible: number | string;
    ytd_giving: number | string;
    gift_count: number;
    first_gift_date: string | null;
    last_gift_date: string | null;
  };
  byFund: Array<{ fund_name: string; total: number | string }>;
  pledges: Array<{
    pledge_id: number;
    total_pledged_amount: number | string;
    amount_fulfilled: number | string;
    amount_outstanding: number | string;
    pledge_date: string;
    expected_fulfillment_date: string | null;
    pledge_status: string;
    fund_name: string | null;
  }>;
  recentGifts: Array<{
    donation_id: number;
    donation_date: string;
    total_value: number | string;
    tax_deductible_amount: number | string | null;
    receipt_number: string | null;
    donation_type: string;
    payment_method: string | null;
    acknowledgement_status: string | null;
    funds: string | null;
  }>;
}

export function DonorDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery<DonorDetailResponse>({
    queryKey: ['donor', id],
    queryFn: () => apiGet(`/api/donors/${id}`),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const d = data.donor;
  const t = data.totals;
  const fullName = `${d.first_name} ${d.middle_name ?? ''} ${d.last_name}`.replace(/\s+/g, ' ').trim();
  const totalByFund = data.byFund.reduce((s, f) => s + Number(f.total ?? 0), 0);

  return (
    <>
      <DetailNavBar
        listLabel="donors" singularLabel="donor" basePath="/donors"
        prevId={null} nextId={null}
        actions={
          <>
            <Link to="/admin/tbl_donor/new" className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta">
              + New donor
            </Link>
            <Link to={`/admin/tbl_donor/${id}/edit`} className="btn-primary text-xs py-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </Link>
          </>
        }
      />

      {/* Donor header */}
      <div className="flex gap-5 p-5 bg-cream border border-hairline rounded-[10px] mb-6">
        <Avatar name={fullName} size="lg" />
        <div className="flex-1">
          <div className="flex items-baseline gap-3.5 mb-1 flex-wrap">
            <div className="font-display text-2xl font-medium">{fullName}</div>
            <span className="pill pill-terra">{d.donor_type}</span>
            {d.is_recurring && <span className="pill pill-sage">Recurring</span>}
            {d.do_not_contact && <span className="pill pill-terra">Do not contact</span>}
            {d.employer_match_eligible && <span className="pill pill-gold">Employer match</span>}
            {d.donor_stage && <span className="pill pill-muted">Stage: {d.donor_stage}</span>}
          </div>
          <div className="flex gap-4 text-sm text-ink-soft flex-wrap">
            {d.mobile_phone && <span>{d.mobile_phone}</span>}
            {d.email && <><span>·</span><span>{d.email}</span></>}
            {d.address && <><span>·</span><span>{d.address}{d.address2 ? `, ${d.address2}` : ''}, {d.city}</span></>}
            {d.donor_advised_fund_name && <><span>·</span><span>DAF: <span className="text-ink font-medium">{d.donor_advised_fund_name}</span></span></>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-faint tracking-widest uppercase font-medium">Lifetime giving</div>
          <div className="font-display text-3xl font-medium leading-none">{formatMoney(t.lifetime_giving)}</div>
          <div className="text-[11px] text-ink-soft mt-1">
            <span>{t.gift_count} gift{t.gift_count === 1 ? '' : 's'}</span>
            {t.first_gift_date && <> · since {formatShortDate(t.first_gift_date)}</>}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat label="YTD" value={formatMoney(t.ytd_giving)} />
        <Stat label="Lifetime tax-deductible" value={formatMoney(t.lifetime_tax_deductible)} />
        <Stat label="Last gift" value={t.last_gift_date ? formatShortDate(t.last_gift_date) : 'Never'} />
        <Stat label="Outstanding pledges" value={formatMoney(
          data.pledges
            .filter(p => p.pledge_status !== 'Fulfilled' && p.pledge_status !== 'Cancelled')
            .reduce((s, p) => s + Number(p.amount_outstanding ?? 0), 0)
        )} />
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-5">
        <div className="space-y-4">
          {/* Gift history */}
          <div className="card">
            <div className="card-head">
              <h3 className="font-display font-medium text-[17px] m-0">Gift history</h3>
              <Link to={`/donations?donor_id=${d.donor_id}`} className="text-xs text-terracotta hover:text-terracotta-deep">
                View in donations →
              </Link>
            </div>
            {data.recentGifts.length === 0 ? (
              <div className="text-sm text-ink-faint italic">No gifts recorded yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Date</th>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Type</th>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Funds</th>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Receipt</th>
                    <th className="text-right text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentGifts.map(g => (
                    <tr key={g.donation_id} className="border-t border-hairline">
                      <td className="py-2.5 pr-3">
                        <Link to={`/donations/${g.donation_id}`} className="text-terracotta font-medium text-xs">
                          {formatLongDate(g.donation_date)}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">
                        {g.donation_type}
                        {g.payment_method && <span className="text-ink-faint"> · {g.payment_method}</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-ink-soft">{g.funds ?? '—'}</td>
                      <td className="py-2.5 pr-3 text-xs font-mono">{g.receipt_number ?? <span className="text-ink-faint">—</span>}</td>
                      <td className="py-2.5 text-right font-display font-medium">{formatMoney(g.total_value)}</td>
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
                <h3 className="font-display font-medium text-[17px] m-0">Pledges</h3>
                <Link to={`/pledges?donor_id=${d.donor_id}`} className="text-xs text-terracotta hover:text-terracotta-deep">
                  View in pledges →
                </Link>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Pledged</th>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Fund</th>
                    <th className="text-right text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Amount</th>
                    <th className="text-right text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Outstanding</th>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pledges.map(p => (
                    <tr key={p.pledge_id} className="border-t border-hairline">
                      <td className="py-2.5 pr-3 text-xs">
                        <Link to={`/pledges/${p.pledge_id}`} className="text-terracotta font-medium">
                          {formatShortDate(p.pledge_date)}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{p.fund_name ?? <span className="text-ink-faint italic">—</span>}</td>
                      <td className="py-2.5 text-right font-display font-medium">{formatMoney(p.total_pledged_amount)}</td>
                      <td className="py-2.5 text-right text-xs">{formatMoney(p.amount_outstanding)}</td>
                      <td className="py-2.5"><StatusPill status={p.pledge_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* By-fund breakdown */}
          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Giving by fund</h3>
            </div>
            {data.byFund.length === 0 ? (
              <div className="text-xs text-ink-faint italic">No designated gifts yet.</div>
            ) : (
              <div className="space-y-2">
                {data.byFund.map(f => {
                  const pct = totalByFund > 0 ? Math.round((Number(f.total) / totalByFund) * 100) : 0;
                  return (
                    <div key={f.fund_name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-ink">{f.fund_name}</span>
                        <span className="text-ink-soft font-medium">{formatMoney(f.total)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-cream-deep rounded-full overflow-hidden">
                        <div className="h-full bg-terracotta" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contact card */}
          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Contact</h3>
            </div>
            <Detail label="Mobile" value={d.mobile_phone ?? '—'} />
            <Detail label="Home" value={d.home_phone ?? '—'} />
            <Detail label="Other" value={d.other_phone ?? '—'} />
            <Detail label="Email" value={d.email ?? '—'} />
            <Detail label="Preferred" value={d.preferred_contact_method ?? '—'} />
            <Detail label="Found us via" value={d.how_they_found_us ?? '—'} />
          </div>

          {/* Quick actions */}
          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Quick actions</h3>
            </div>
            <Link
              to={`/donations/new?donor_id=${d.donor_id}`}
              className="block text-xs text-ink-soft hover:text-terracotta py-1.5"
            >
              + Record a gift from this donor →
            </Link>
            <Link
              to={`/pledges/new?donor_id=${d.donor_id}`}
              className="block text-xs text-ink-soft hover:text-terracotta py-1.5"
            >
              + Record a pledge from this donor →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium">{label}</div>
      <div className="font-display text-2xl font-medium leading-none mt-1">{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2 py-1 text-xs">
      <div className="text-ink-faint uppercase tracking-wider text-[10px] font-medium">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  );
}
