/**
 * Pledges list — commitments to give, distinct from completed gifts.
 * Filterable by status, donor, fund, and overdue.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, formatMoney, formatShortDate } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox, EmptyState, StatusPill } from '../components/ui.tsx';
import { FkSelect } from '../components/admin/FkSelect.tsx';

interface PledgeRow {
  pledge_id: number;
  donor_id: number;
  donor_name: string;
  fund_id: number | null;
  fund_name: string | null;
  total_pledged_amount: number | string;
  amount_fulfilled: number | string;
  amount_outstanding: number | string;
  pledge_date: string;
  expected_fulfillment_date: string | null;
  pledge_status_id: number;
  pledge_status: string;
}

export function Pledges() {
  const [statusId, setStatusId] = useState<number | null>(null);
  const [donorId, setDonorId] = useState<number | null>(null);
  const [fundId, setFundId] = useState<number | null>(null);
  const [overdue, setOverdue] = useState(false);

  const filtersActive = !!(statusId || donorId || fundId || overdue);

  const { data, isLoading, error } = useQuery<PledgeRow[]>({
    queryKey: ['pledges', statusId, donorId, fundId, overdue],
    queryFn: () => apiGet('/api/pledges', {
      status_id: statusId ? String(statusId) : undefined,
      donor_id:  donorId  ? String(donorId)  : undefined,
      fund_id:   fundId   ? String(fundId)   : undefined,
      overdue:   overdue ? 'true' : undefined,
    }),
  });

  const totalPledged = data?.reduce((s, p) => s + Number(p.total_pledged_amount ?? 0), 0) ?? 0;
  const totalOutstanding = data?.reduce((s, p) => s + Number(p.amount_outstanding ?? 0), 0) ?? 0;

  return (
    <>
      <PageHeader
        helpSection="pledges"
        title="Pledges"
        emphasis="& commitments"
        subtitle="Multi-payment commitments. Track how much has been fulfilled and what's still expected."
        actions={
          <Link to="/pledges/new" className="btn-primary">
            <span className="text-base leading-none">+</span> New pledge
          </Link>
        }
      />

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="field-label">Status</label>
            <FkSelect fkTable="lkp_pledge_status" value={statusId} onChange={setStatusId} />
          </div>
          <div>
            <label className="field-label">Donor</label>
            <FkSelect fkTable="tbl_donor" value={donorId} onChange={setDonorId} />
          </div>
          <div>
            <label className="field-label">Fund</label>
            <FkSelect fkTable="lkp_fund" value={fundId} onChange={setFundId} />
          </div>
          <div>
            <label className="field-label">Aging</label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={overdue}
                onChange={e => setOverdue(e.target.checked)}
                className="w-4 h-4 accent-terracotta"
              />
              Show overdue only
            </label>
          </div>
        </div>
        {filtersActive && (
          <div className="mt-3 pt-3 border-t border-hairline flex justify-between items-center">
            <div className="text-xs text-ink-faint">
              {(data?.length ?? 0).toLocaleString()} pledge{(data?.length ?? 0) === 1 ? '' : 's'} ·
              Outstanding <span className="text-ink font-medium">{formatMoney(totalOutstanding)}</span>
            </div>
            <button
              onClick={() => { setStatusId(null); setDonorId(null); setFundId(null); setOverdue(false); }}
              className="text-xs text-terracotta hover:text-terracotta-deep"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading && <Loading />}
        {error && <ErrorBox error={error} />}
        {data && data.length === 0 && (
          <EmptyState
            title={filtersActive ? 'No pledges match' : 'No pledges yet'}
            hint={filtersActive ? 'Try widening the filters.' : 'Click "New pledge" to record a commitment.'}
          />
        )}
        {data && data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <Th>Donor</Th>
                <Th>Fund</Th>
                <Th className="text-right">Pledged</Th>
                <Th className="text-right">Fulfilled</Th>
                <Th className="text-right">Outstanding</Th>
                <Th>Expected by</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.map(p => {
                const isOverdue = !!p.expected_fulfillment_date
                  && new Date(p.expected_fulfillment_date) < new Date()
                  && p.pledge_status !== 'Fulfilled' && p.pledge_status !== 'Cancelled';
                const fulfilledPct = Math.min(100, Math.round(
                  (Number(p.amount_fulfilled) / Math.max(1, Number(p.total_pledged_amount))) * 100,
                ));
                return (
                  <tr key={p.pledge_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                    <td className="px-5 py-3">
                      <Link to={`/pledges/${p.pledge_id}`} className="text-terracotta font-medium">
                        {p.donor_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-xs">{p.fund_name ?? <span className="text-ink-faint italic">Unspecified</span>}</td>
                    <td className="px-5 py-3 text-right font-display font-medium">{formatMoney(p.total_pledged_amount)}</td>
                    <td className="px-5 py-3 text-right text-xs">
                      <div className="text-ink">{formatMoney(p.amount_fulfilled)}</div>
                      <div className="w-full h-1 bg-cream-deep rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-sage" style={{ width: `${fulfilledPct}%` }} />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-ink-soft">{formatMoney(p.amount_outstanding)}</td>
                    <td className="px-5 py-3 text-xs">
                      {p.expected_fulfillment_date
                        ? <span className={isOverdue ? 'text-terracotta-deep font-medium' : ''}>
                            {formatShortDate(p.expected_fulfillment_date)}
                            {isOverdue && <span className="text-[10px] block">overdue</span>}
                          </span>
                        : <span className="text-ink-faint">—</span>}
                    </td>
                    <td className="px-5 py-3"><StatusPill status={p.pledge_status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && data.length > 0 && (
        <div className="mt-3 text-xs text-ink-faint text-right">
          <span>Total pledged: <span className="text-ink font-medium">{formatMoney(totalPledged)}</span></span>
          <span className="mx-3 text-hairline-strong">·</span>
          <span>Outstanding: <span className="text-ink font-medium">{formatMoney(totalOutstanding)}</span></span>
        </div>
      )}
    </>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3 ${className}`}>
      {children}
    </th>
  );
}
