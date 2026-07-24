/**
 * Vendor list — suppliers, trades-people, service providers,
 * professionals. Operational directory only — bills + payments live
 * in QuickBooks (see /api/vendors backend for the boundary doc).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox, EmptyState } from '../components/ui.tsx';

export interface VendorListRow {
  vendor_id: number;
  business_name: string | null;
  is_active: boolean;
  w9_received: boolean;
  w9_received_date: string | null;
  coi_received: boolean;
  coi_expires_at: string | null;
  payment_terms: string | null;
  default_hourly_rate: string | null;
  vendor_type: string;
  vendor_specialty: string | null;
  contact_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  mobile_phone: string | null;
  home_phone: string | null;
}

interface LookupRow { id: number; label: string }

export function Vendors() {
  const [search, setSearch] = useState('');
  const [typeId, setTypeId] = useState<string>('');
  const [specialtyId, setSpecialtyId] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState(true);

  const { data: rows, isLoading, error } = useQuery<VendorListRow[]>({
    queryKey: ['vendors', { search, typeId, specialtyId, activeOnly }],
    queryFn: () => apiGet('/api/vendors', {
      search: search || undefined,
      type_id: typeId || undefined,
      specialty_id: specialtyId || undefined,
      active_only: activeOnly ? '1' : undefined,
    }),
  });

  const { data: types } = useQuery<LookupRow[]>({
    queryKey: ['lookup', 'vendor_type'],
    queryFn: () => apiGet('/api/lookups/vendor_type'),
  });
  const { data: specialties } = useQuery<LookupRow[]>({
    queryKey: ['lookup', 'vendor_specialty'],
    queryFn: () => apiGet('/api/lookups/vendor_specialty'),
  });

  return (
    <>
      <PageHeader
        helpSection="vendors"
        title="Vendors"
        emphasis="directory"
        subtitle="Suppliers, trades-people, and service providers. Bills + payments stay in QuickBooks; this is operational."
        actions={
          <Link to="/vendors/new" className="btn-primary">+ New vendor</Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, business, email"
          className="field-input max-w-xs"
        />
        <select value={typeId} onChange={e => setTypeId(e.target.value)} className="field-input max-w-xs">
          <option value="">All types</option>
          {types?.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select value={specialtyId} onChange={e => setSpecialtyId(e.target.value)} className="field-input max-w-xs">
          <option value="">All specialties</option>
          {specialties?.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="w-4 h-4 accent-terracotta" />
          Active only
        </label>
      </div>

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}
      {rows && rows.length === 0 && (
        <EmptyState title="No vendors yet" hint='Click "+ New vendor" to add your first one.' />
      )}

      {rows && rows.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-cream/50 border-b border-hairline">
              <tr className="text-xs text-ink-faint uppercase tracking-widest">
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Type / Specialty</th>
                <th className="text-left px-4 py-2.5 font-medium">Contact</th>
                <th className="text-left px-4 py-2.5 font-medium">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map(r => (
                <tr key={r.vendor_id} className="hover:bg-terracotta/[0.04]">
                  <td className="px-4 py-2.5">
                    <Link to={`/vendors/${r.vendor_id}`} className="font-medium hover:text-terracotta">
                      {r.business_name || `${r.first_name} ${r.last_name}`}
                    </Link>
                    {r.business_name && (
                      <div className="text-[11px] text-ink-faint">{r.first_name} {r.last_name}</div>
                    )}
                    {!r.is_active && <span className="ml-2 pill pill-muted">Inactive</span>}
                  </td>
                  <td className="px-4 py-2.5 text-sm">
                    <div>{r.vendor_type}</div>
                    {r.vendor_specialty && <div className="text-[11px] text-ink-faint">{r.vendor_specialty}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-ink-soft">
                    {r.email && <div className="truncate max-w-xs">{r.email}</div>}
                    {r.mobile_phone && <div className="text-[11px] text-ink-faint">{r.mobile_phone}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {r.w9_received
                      ? <span className="pill pill-sage">W-9 ✓</span>
                      : <span className="pill pill-terra">W-9 missing</span>}
                    {r.coi_received && (
                      <span className={`ml-1 pill ${coiExpiringSoon(r.coi_expires_at) ? 'pill-gold' : 'pill-sage'}`}>
                        COI{r.coi_expires_at ? ` expires ${shortDate(r.coi_expires_at)}` : ''}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function coiExpiringSoon(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso); if (isNaN(d.getTime())) return false;
  const days = (d.getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= 60; // expiring within 60 days → gold/warning
}

function shortDate(iso: string): string {
  const d = new Date(iso); if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
