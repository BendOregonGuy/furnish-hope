/**
 * List of households this caseworker's agency has referred. Search +
 * status counts. Click a row → detail (request status follow-up).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api.ts';

interface Referral {
  client_id: number;
  client_name: string;
  client_type: string;
  client_status: string;
  referral_date: string;
  address: string | null;
  city: string | null;
  request_count: number;
}

export function AgencyReferrals() {
  const [search, setSearch] = useState('');
  const { data: rows, isLoading } = useQuery<Referral[]>({
    queryKey: ['agency', 'referrals', search],
    queryFn: () => apiGet('/api/agency/referrals', { search: search || undefined }),
  });

  return (
    <>
      <div className="mb-5 flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-medium m-0">My referrals</h1>
        <Link to="/agency/referrals/new" className="btn-primary">+ Refer a household</Link>
      </div>

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="field-input max-w-md"
        />
      </div>

      {isLoading && <div className="text-sm text-ink-faint">Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="card text-center text-sm text-ink-faint italic">
          {search ? 'No matches for that search.' : 'No referrals yet.'}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-cream/50 border-b border-hairline">
              <tr className="text-xs text-ink-faint uppercase tracking-widest">
                <th className="text-left px-4 py-2.5 font-medium">Household</th>
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-left px-4 py-2.5 font-medium">City</th>
                <th className="text-left px-4 py-2.5 font-medium">Referred</th>
                <th className="text-right px-4 py-2.5 font-medium">Requests</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map(r => (
                <tr key={r.client_id} className="hover:bg-terracotta/[0.04]">
                  <td className="px-4 py-2.5">
                    <Link to={`/agency/referrals/${r.client_id}`} className="font-medium hover:text-terracotta">
                      {r.client_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-sm">{r.client_type}</td>
                  <td className="px-4 py-2.5 text-sm text-ink-soft">{r.city ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-ink-soft">{formatDate(r.referral_date)}</td>
                  <td className="px-4 py-2.5 text-sm text-right">{r.request_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso); if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
