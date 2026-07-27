/**
 * Visit detail — read-only summary of a scheduled or completed client
 * visit, with Edit button and quick links to the client and the
 * linked provisioning request.
 */

import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiGet, formatLongDate } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox, StatusPill } from '../components/ui.tsx';
import { DetailNavBar } from '../components/forms/FormNavBar.tsx';
import { HelpLink } from '../components/HelpLink.tsx';

interface VisitDetailResponse {
  visit: {
    client_visit_id: number;
    client_id: number;
    client_name: string;
    client_phone: string | null;
    client_email: string | null;
    visit_date: string;
    start_time: string | null;
    end_time: string | null;
    visit_mode: string;
    visit_status: string;
    facility_name: string | null;
    host_name: string | null;
    client_provisioning_request_id: number | null;
    visit_type: string | null;
    selection_type: string | null;
    notes: string | null;
    created_at: string;
  };
  prevId: number | null;
  nextId: number | null;
}

export function VisitDetail() {
  const { id } = useParams();

  const { data, isLoading, error } = useQuery<VisitDetailResponse>({
    queryKey: ['visit', id],
    queryFn: () => apiGet(`/api/visits/${id}`),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const v = data.visit;

  return (
    <>
      <PageHeader
        helpSection="visits"
        title={`Visit · ${v.client_name}`}
        subtitle={`${formatLongDate(v.visit_date)} · ${v.visit_mode}`}
        actions={<HelpLink section="visits" />}
      />

      <DetailNavBar
        listLabel="visits" singularLabel="visit" basePath="/visits"
        prevId={data.prevId} nextId={data.nextId}
        actions={
          <>
            <Link to="/visits/new" className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta">+ Schedule visit</Link>
            <Link to={`/visits/${id}/edit`} className="btn-primary text-xs py-1.5">Edit</Link>
          </>
        }
      />

      <div className="card space-y-4 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Detail label="Client">
            <Link to={`/clients/${v.client_id}`} className="text-terracotta hover:text-terracotta-deep font-medium">
              {v.client_name}
            </Link>
            {v.client_phone && <div className="text-[11px] text-ink-faint">{v.client_phone}</div>}
            {v.client_email && <div className="text-[11px] text-ink-faint">{v.client_email}</div>}
          </Detail>
          <Detail label="Status">
            <StatusPill status={v.visit_status} />
          </Detail>
          <Detail label="Date">{formatLongDate(v.visit_date)}</Detail>
          <Detail label="Time">
            {v.start_time && v.end_time
              ? `${formatTime(v.start_time)} – ${formatTime(v.end_time)}`
              : v.start_time ? formatTime(v.start_time) : '—'}
          </Detail>
          <Detail label="Mode">{v.visit_mode}</Detail>
          <Detail label="Visit type">{v.visit_type ?? '—'}</Detail>
          {v.visit_type === 'Selection of Items' && (
            <Detail label="Selection type">{v.selection_type ?? '—'}</Detail>
          )}
          <Detail label="Host">{v.host_name ?? '—'}</Detail>
          <Detail label="Location">{v.facility_name ?? (v.visit_mode === 'In-person' ? '— (set a facility)' : '— (n/a)')}</Detail>
          <Detail label="Linked packing list">
            {v.client_provisioning_request_id
              ? <Link to={`/requests/${v.client_provisioning_request_id}`} className="text-terracotta hover:text-terracotta-deep">Packing list #{v.client_provisioning_request_id}</Link>
              : <span className="text-ink-faint">—</span>}
          </Detail>
        </div>

        {v.notes && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-1">Notes</div>
            <div className="text-sm text-ink whitespace-pre-wrap">{v.notes}</div>
          </div>
        )}
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-1">{label}</div>
      <div className="text-sm text-ink">{children}</div>
    </div>
  );
}

function formatTime(t: string): string {
  const [hh, mm] = t.split(':');
  let h = Number(hh);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${ampm}`;
}
