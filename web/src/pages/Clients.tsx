import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, formatShortDate } from '../lib/api.ts';
import { PageHeader, StatusPill, Avatar, Loading, ErrorBox, EmptyState } from '../components/ui.tsx';

type Client = {
  client_id: number;
  first_name: string;
  last_name: string;
  mobile_phone: string | null;
  client_type: string;             // legacy primary; kept for back-compat
  client_types?: string[];         // multi-select (Phase C household-type-multi)
  client_status: string;
  start_date: string | null;
  referring_agency: string | null;
};

export function Clients() {
  const [search, setSearch] = useState('');
  const { data: clients, isLoading, error } = useQuery<Client[]>({
    queryKey: ['clients', search],
    queryFn: () => apiGet('/api/clients', { search }),
  });

  return (
    <>
      <PageHeader
        helpSection="clients"
        title="All"
        emphasis="clients"
        subtitle="Households we're currently serving or have served through the Cycle of Hope."
        actions={
          <Link to="/clients/new" className="btn-primary">
            <span className="text-base leading-none">+</span> New client
          </Link>
        }
      />

      <div className="mb-5 flex gap-3">
        <input
          type="text"
          className="field-input max-w-sm"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading && <Loading />}
        {error && <ErrorBox error={error} />}
        {clients && clients.length === 0 && <EmptyState title="No clients yet" hint="Start by creating a referral." />}
        {clients && clients.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Client</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Type</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Referred by</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Started</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.client_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                  <td className="px-5 py-3">
                    <Link to={`/clients/${c.client_id}`} className="flex items-center gap-2.5">
                      <Avatar name={`${c.first_name} ${c.last_name}`} />
                      <div>
                        <div className="font-medium">{c.first_name} {c.last_name}</div>
                        <div className="text-[11px] text-ink-faint">{c.mobile_phone ?? ''}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    {c.client_types && c.client_types.length > 0
                      ? (
                        <div className="flex flex-wrap gap-1">
                          {c.client_types.map(t => (
                            <span key={t} className="pill pill-terra text-[10px]">{t}</span>
                          ))}
                        </div>
                      )
                      : c.client_type}
                  </td>
                  <td className="px-5 py-3">{c.referring_agency ?? '—'}</td>
                  <td className="px-5 py-3">{formatShortDate(c.start_date)}</td>
                  <td className="px-5 py-3"><StatusPill status={c.client_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
