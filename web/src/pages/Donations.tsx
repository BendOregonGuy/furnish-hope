/**
 * Donations list. Filterable by date range, donor, fund, payment method,
 * donation type, acknowledgement status, and receipt presence.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, formatMoney, formatShortDate } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox, EmptyState, StatusPill } from '../components/ui.tsx';
import { FkSelect } from '../components/admin/FkSelect.tsx';

interface DonationRow {
  donation_id: number;
  donation_date: string;
  total_value: number | string;
  tax_deductible_amount: number | string | null;
  receipt_number: string | null;
  acknowledgement_status_id: number | null;
  donor_id: number;
  donor_name: string;
  donation_type: string;
  payment_method: string | null;
  acknowledgement_status: string | null;
}

export function Donations() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [donorId, setDonorId] = useState<number | null>(null);
  const [fundId, setFundId] = useState<number | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
  const [donationTypeId, setDonationTypeId] = useState<number | null>(null);
  const [hasReceipt, setHasReceipt] = useState<string>(''); // '' | 'true' | 'false'

  const filtersActive = !!(from || to || donorId || fundId || paymentMethodId || donationTypeId || hasReceipt);

  const { data, isLoading, error } = useQuery<DonationRow[]>({
    queryKey: ['donations', from, to, donorId, fundId, paymentMethodId, donationTypeId, hasReceipt],
    queryFn: () => apiGet('/api/donations', {
      from: from || undefined,
      to: to || undefined,
      donor_id: donorId ? String(donorId) : undefined,
      fund_id: fundId ? String(fundId) : undefined,
      payment_method_id: paymentMethodId ? String(paymentMethodId) : undefined,
      donation_type_id: donationTypeId ? String(donationTypeId) : undefined,
      has_receipt: hasReceipt || undefined,
    }),
  });

  function clearFilters() {
    setFrom(''); setTo(''); setDonorId(null); setFundId(null);
    setPaymentMethodId(null); setDonationTypeId(null); setHasReceipt('');
  }

  const total = data?.reduce((sum, d) => sum + Number(d.total_value ?? 0), 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Financial"
        emphasis="donations"
        subtitle="Cash, check, credit card, stock, and other monetary gifts. Track designations, pledges, and acknowledgements."
        actions={
          <Link to="/donations/new" className="btn-primary">
            <span className="text-base leading-none">+</span> New donation
          </Link>
        }
      />

      {/* Filters */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="field-label">From</label>
            <input type="date" className="field-input" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="field-label">To</label>
            <input type="date" className="field-input" value={to} onChange={e => setTo(e.target.value)} />
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
            <label className="field-label">Payment method</label>
            <FkSelect fkTable="lkp_payment_method" value={paymentMethodId} onChange={setPaymentMethodId} />
          </div>
          <div>
            <label className="field-label">Donation type</label>
            <FkSelect fkTable="lkp_donation_type" value={donationTypeId} onChange={setDonationTypeId} />
          </div>
          <div>
            <label className="field-label">Receipt</label>
            <select className="field-input" value={hasReceipt} onChange={e => setHasReceipt(e.target.value)}>
              <option value="">Any</option>
              <option value="true">Has receipt</option>
              <option value="false">No receipt yet</option>
            </select>
          </div>
        </div>
        {filtersActive && (
          <div className="mt-3 pt-3 border-t border-hairline flex justify-between items-center">
            <div className="text-xs text-ink-faint">
              {(data?.length ?? 0).toLocaleString()} matching · Total <span className="text-ink font-medium">{formatMoney(total)}</span>
            </div>
            <button onClick={clearFilters} className="text-xs text-terracotta hover:text-terracotta-deep">
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
            title={filtersActive ? 'No donations match' : 'No donations yet'}
            hint={filtersActive ? 'Try widening the filters.' : 'Click "New donation" to record one.'}
          />
        )}
        {data && data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <Th>Date</Th>
                <Th>Donor</Th>
                <Th>Type</Th>
                <Th>Method</Th>
                <Th className="text-right">Amount</Th>
                <Th>Receipt #</Th>
                <Th>Ack</Th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.donation_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                  <td className="px-5 py-3 text-xs whitespace-nowrap">
                    <Link to={`/donations/${d.donation_id}`} className="text-terracotta font-medium">
                      {formatShortDate(d.donation_date)}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{d.donor_name}</td>
                  <td className="px-5 py-3 text-xs">{d.donation_type}</td>
                  <td className="px-5 py-3 text-xs text-ink-soft">{d.payment_method ?? '—'}</td>
                  <td className="px-5 py-3 text-right font-display font-medium">
                    {formatMoney(d.total_value)}
                  </td>
                  <td className="px-5 py-3 text-xs font-mono">{d.receipt_number ?? <span className="text-ink-faint italic">none</span>}</td>
                  <td className="px-5 py-3">
                    {d.acknowledgement_status
                      ? <StatusPill status={d.acknowledgement_status} />
                      : <span className="text-[11px] text-ink-faint">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.length > 0 && !filtersActive && (
        <div className="mt-3 text-xs text-ink-faint text-right">
          Total of shown: <span className="text-ink font-medium">{formatMoney(total)}</span>
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
