/**
 * Volunteer shifts list. Filterable by date range, type, and status.
 * Shows capacity (filled / needed) so dispatchers can see at a glance
 * which shifts still need bodies.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, formatShortDate } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox, EmptyState, StatusPill } from '../components/ui.tsx';
import { FkSelect } from '../components/admin/FkSelect.tsx';

interface ShiftRow {
  shift_id: number;
  shift_name: string | null;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  capacity_needed: number;
  shift_type: string;
  shift_status: string;
  facility_name: string | null;
  filled_count: number;
}

export function Shifts() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [typeId, setTypeId] = useState<number | null>(null);
  const [statusId, setStatusId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<ShiftRow[]>({
    queryKey: ['shifts', from, to, typeId, statusId],
    queryFn: () => apiGet('/api/shifts', {
      from: from || undefined,
      to:   to   || undefined,
      type_id:   typeId   ? String(typeId)   : undefined,
      status_id: statusId ? String(statusId) : undefined,
    }),
  });

  const filtersActive = !!(from || to || typeId || statusId);

  return (
    <>
      <PageHeader
        helpSection="shifts"
        title="Volunteer"
        emphasis="shifts"
        subtitle="Scheduled time blocks volunteers and staff sign up for. Pickup crew, warehouse, events, outreach."
        actions={
          <Link to="/shifts/new" className="btn-primary text-xs py-1.5">+ New shift</Link>
        }
      />

      <div className="card mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="field-label">From</label>
            <input type="date" className="field-input" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="field-label">To</label>
            <input type="date" className="field-input" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Type</label>
            <FkSelect fkTable="lkp_shift_type" value={typeId} onChange={setTypeId} />
          </div>
          <div>
            <label className="field-label">Status</label>
            <FkSelect fkTable="lkp_shift_status" value={statusId} onChange={setStatusId} />
          </div>
        </div>
      </div>

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}
      <div className="card">
        {data && data.length === 0 && (
          <EmptyState
            title="No shifts match"
            hint={filtersActive ? 'Widen the filters or' : 'Click'} />
        )}
        {data && data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <Th>Date</Th>
                <Th>Type / Name</Th>
                <Th>Time</Th>
                <Th>Facility</Th>
                <Th className="text-right">Capacity</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.map(s => {
                const full = s.filled_count >= s.capacity_needed;
                return (
                  <tr key={s.shift_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                    <td className="px-5 py-3 text-xs whitespace-nowrap">
                      <Link to={`/shifts/${s.shift_id}`} className="text-terracotta font-medium">
                        {formatShortDate(s.shift_date)}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium">{s.shift_name ?? s.shift_type}</div>
                      {s.shift_name && <div className="text-[11px] text-ink-faint">{s.shift_type}</div>}
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-soft">
                      {s.start_time && s.end_time
                        ? `${formatTime(s.start_time)} – ${formatTime(s.end_time)}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-soft">{s.facility_name ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-xs">
                      <span className={full ? 'text-sage-deep font-medium' : 'text-ink-soft'}>
                        {s.filled_count} / {s.capacity_needed}
                      </span>
                    </td>
                    <td className="px-5 py-3"><StatusPill status={s.shift_status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-5 py-2.5 text-[10px] uppercase tracking-widest text-ink-faint font-medium ${className ?? ''}`}>{children}</th>;
}

function formatTime(t: string): string {
  const [hh, mm] = t.split(':');
  let h = Number(hh);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${ampm}`;
}
