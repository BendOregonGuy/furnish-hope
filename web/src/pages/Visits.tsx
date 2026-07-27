/**
 * Client visits list — scheduled and past appointments where a client
 * chooses their furniture. Filterable by date, status, mode, visit type,
 * selection type, and location.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, formatShortDate } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox, EmptyState, StatusPill } from '../components/ui.tsx';
import { FkSelect } from '../components/admin/FkSelect.tsx';

const VISIT_TYPE_OPTIONS = ['Delivery', 'Donation Center Pick Up', 'Selection of Items'];
const SELECTION_TYPE_OPTIONS = ['Guest Selection Appointment', 'Video Call Appointment', 'Volunteer Selection'];

interface VisitRow {
  client_visit_id: number;
  client_id: number;
  client_name: string;
  visit_date: string;
  start_time: string | null;
  end_time: string | null;
  visit_mode: string;
  visit_status: string;
  visit_type: string | null;
  selection_type: string | null;
  facility_name: string | null;
  host_name: string | null;
}

export function Visits() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statusId, setStatusId] = useState<number | null>(null);
  const [visitType, setVisitType] = useState('');
  const [selectionType, setSelectionType] = useState('');
  const [facilityId, setFacilityId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<VisitRow[]>({
    queryKey: ['visits', from, to, statusId, visitType, selectionType, facilityId],
    queryFn: () => apiGet('/api/visits', {
      from: from || undefined,
      to:   to   || undefined,
      status_id: statusId ? String(statusId) : undefined,
      visit_type: visitType || undefined,
      selection_type: selectionType || undefined,
      corp_facility_id: facilityId ? String(facilityId) : undefined,
    }),
  });

  const filtersActive = !!(from || to || statusId || visitType || selectionType || facilityId);

  return (
    <>
      <PageHeader
        helpSection="visits"
        title="Client"
        emphasis="visits"
        subtitle="Scheduled appointments where the client picks out their furniture — in person, by phone, on Zoom, or by email."
        actions={
          <Link to="/visits/new" className="btn-primary text-xs py-1.5">+ Schedule visit</Link>
        }
      />

      <div className="card mb-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="field-label">From</label>
            <input type="date" className="field-input" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="field-label">To</label>
            <input type="date" className="field-input" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Status</label>
            <FkSelect fkTable="lkp_visit_status" value={statusId} onChange={setStatusId} />
          </div>
          <div>
            <label className="field-label">Visit type</label>
            <select className="field-input" value={visitType} onChange={e => setVisitType(e.target.value)}>
              <option value="">All types</option>
              {VISIT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Selection type</label>
            <select className="field-input" value={selectionType} onChange={e => setSelectionType(e.target.value)}>
              <option value="">All selection types</option>
              {SELECTION_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Location</label>
            <FkSelect fkTable="tbl_corp_facility" value={facilityId} onChange={setFacilityId} />
          </div>
        </div>
      </div>

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}
      <div className="card">
        {data && data.length === 0 && (
          <EmptyState
            title="No visits match"
            hint={filtersActive ? 'Widen the filters or schedule a new visit.' : 'Click "+ Schedule visit" to book the first one.'}
          />
        )}
        {data && data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <Th>Date</Th>
                <Th>Client</Th>
                <Th>Time</Th>
                <Th>Mode</Th>
                <Th>Visit type</Th>
                <Th>Selection type</Th>
                <Th>Host</Th>
                <Th>Where</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.map(v => (
                <tr key={v.client_visit_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                  <td className="px-5 py-3 text-xs whitespace-nowrap">
                    <Link to={`/visits/${v.client_visit_id}`} className="text-terracotta font-medium">
                      {formatShortDate(v.visit_date)}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link to={`/clients/${v.client_id}`} className="font-medium text-ink hover:text-terracotta">{v.client_name}</Link>
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-soft">
                    {v.start_time && v.end_time
                      ? `${formatTime(v.start_time)} – ${formatTime(v.end_time)}`
                      : v.start_time ? formatTime(v.start_time) : '—'}
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-soft">{v.visit_mode}</td>
                  <td className="px-5 py-3 text-xs text-ink-soft">{v.visit_type ?? '—'}</td>
                  <td className="px-5 py-3 text-xs text-ink-soft">{v.selection_type ?? '—'}</td>
                  <td className="px-5 py-3 text-xs text-ink-soft">{v.host_name ?? '—'}</td>
                  <td className="px-5 py-3 text-xs text-ink-soft">{v.facility_name ?? '—'}</td>
                  <td className="px-5 py-3"><StatusPill status={v.visit_status} /></td>
                </tr>
              ))}
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
