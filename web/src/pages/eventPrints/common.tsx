/**
 * Shared helpers + types for the event print pages. All print pages
 * call GET /api/events/:id (same shape as EventDetail) and render
 * inside the existing ManifestPage so they inherit the print CSS
 * (letter size, auto-open dialog, screen-only header chrome).
 */

import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet, formatLongDate } from '../../lib/api.ts';
import { Loading, ErrorBox } from '../../components/ui.tsx';
import { ManifestPage, ManifestHeader } from '../../components/manifest/ManifestShell.tsx';

export interface PrintAttendee {
  event_attendee_id: number;
  contact_id: number;
  rsvp_status_label: string | null;
  attended: boolean | null;
  amount_contributed: number | string | null;
  ticket_count: number;
  checked_in_at: string | null;
  table_number: string | null;
  seat_number: string | null;
  dietary_notes: string | null;
  notes: string | null;
  name: string;
  email: string | null;
  mobile_phone: string | null;
}

export interface PrintSponsor {
  event_sponsor_id: number;
  sponsor_level_label: string;
  sponsor_level_sort: number;
  amount_pledged: number | string | null;
  amount_paid: number | string | null;
  corporate_name: string | null;
  contact_name: string | null;
  acknowledged: boolean;
}

export interface PrintEventDetail {
  event: any;
  attendees: PrintAttendee[];
  sponsors: PrintSponsor[];
}

/** Default print-page wrapper. Loads /api/events/:id, shows
 *  spinner/error, then calls `render` with the loaded data wrapped
 *  in <ManifestPage>. */
export function EventPrintPage({
  title,
  render,
}: {
  title: string;
  render: (data: PrintEventDetail) => ReactNode;
}) {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery<PrintEventDetail>({
    queryKey: ['event', id],
    queryFn: () => apiGet(`/api/events/${id}`),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  return (
    <ManifestPage>
      <ManifestHeader
        title={`${data.event.event_name} · ${title}`}
        meta={formatLongDate(data.event.event_date)}
      />
      {render(data)}
    </ManifestPage>
  );
}

/** Stringify a $-amount or "—". */
export function dollars(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n === 0) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Sort attendees alphabetically by last word in their display name. */
export function byLastName<T extends { name: string }>(a: T, b: T): number {
  const la = a.name.split(/\s+/).slice(-1)[0]?.toLowerCase() ?? '';
  const lb = b.name.split(/\s+/).slice(-1)[0]?.toLowerCase() ?? '';
  return la.localeCompare(lb);
}

/** Sort attendees by table number then seat number for place cards. */
export function byTableSeat(a: PrintAttendee, b: PrintAttendee): number {
  const ta = (a.table_number ?? '').toString();
  const tb = (b.table_number ?? '').toString();
  if (ta !== tb) return ta.localeCompare(tb, undefined, { numeric: true });
  const sa = (a.seat_number ?? '').toString();
  const sb = (b.seat_number ?? '').toString();
  return sa.localeCompare(sb, undefined, { numeric: true });
}
