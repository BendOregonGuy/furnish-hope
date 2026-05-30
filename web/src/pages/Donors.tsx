/**
 * Donors list — donor-centric view with lifetime + YTD giving totals.
 * Edit/Create still flows through /admin/tbl_donor (the generic admin
 * tool handles the donor form well enough that we don't duplicate it).
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, formatMoney, formatShortDate } from '../lib/api.ts';
import { PageHeader, Avatar, Loading, ErrorBox, EmptyState } from '../components/ui.tsx';

interface DonorRow {
  donor_id: number;
  donor_name: string;
  mobile_phone: string | null;
  email: string | null;
  donor_type: string;
  is_recurring: boolean;
  do_not_contact: boolean;
  lifetime_giving: number | string;
  ytd_giving: number | string;
  last_gift_date: string | null;
  gift_count: number;
}

export function Donors() {
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery<DonorRow[]>({
    queryKey: ['donors', search],
    queryFn: () => apiGet('/api/donors', { search: search || undefined }),
  });

  const totalLifetime = data?.reduce((s, d) => s + Number(d.lifetime_giving ?? 0), 0) ?? 0;
  const totalYTD = data?.reduce((s, d) => s + Number(d.ytd_giving ?? 0), 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Donors"
        emphasis="& funders"
        subtitle="Everyone who has given (or pledged) to Furnish Hope. Sorted by lifetime giving."
        actions={
          <Link to="/admin/tbl_donor/new" className="btn-primary">
            <span className="text-base leading-none">+</span> New donor
          </Link>
        }
      />

      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <input
          type="text"
          className="field-input max-w-sm"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="text-xs text-ink-faint">
          {(data?.length ?? 0).toLocaleString()} donor{(data?.length ?? 0) === 1 ? '' : 's'} ·
          Lifetime <span className="text-ink font-medium">{formatMoney(totalLifetime)}</span> ·
          YTD <span className="text-ink font-medium">{formatMoney(totalYTD)}</span>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading && <Loading />}
        {error && <ErrorBox error={error} />}
        {data && data.length === 0 && (
          <EmptyState
            title={search ? 'No donors match' : 'No donors yet'}
            hint={search ? 'Try a different search.' : 'Click "New donor" to add one.'}
          />
        )}
        {data && data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <Th>Donor</Th>
                <Th>Type</Th>
                <Th className="text-right">Lifetime</Th>
                <Th className="text-right">YTD</Th>
                <Th className="text-right">Gifts</Th>
                <Th>Last gift</Th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.donor_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                  <td className="px-5 py-3">
                    <Link to={`/donors/${d.donor_id}`} className="flex items-center gap-2.5">
                      <Avatar name={d.donor_name} />
                      <div>
                        <div className="font-medium">{d.donor_name}</div>
                        <div className="text-[11px] text-ink-faint">
                          {d.email ?? d.mobile_phone ?? '—'}
                          {d.is_recurring && <span className="ml-2 pill pill-sage text-[9px] py-0">Recurring</span>}
                          {d.do_not_contact && <span className="ml-2 pill pill-terra text-[9px] py-0">Do not contact</span>}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-soft">{d.donor_type}</td>
                  <td className="px-5 py-3 text-right font-display font-medium">{formatMoney(d.lifetime_giving)}</td>
                  <td className="px-5 py-3 text-right text-xs">{formatMoney(d.ytd_giving)}</td>
                  <td className="px-5 py-3 text-right text-xs text-ink-soft">{d.gift_count}</td>
                  <td className="px-5 py-3 text-xs text-ink-soft">{d.last_gift_date ? formatShortDate(d.last_gift_date) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
