/**
 * Read-only event detail with attendee list + one-click check-in.
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, apiPost, formatLongDate, formatMoney } from '../lib/api.ts';
import { Loading, ErrorBox, Avatar } from '../components/ui.tsx';
import { DetailNavBar } from '../components/forms/FormNavBar.tsx';
import { AttachmentsWidget } from '../components/attachments/AttachmentsWidget.tsx';

interface SponsorRow {
  event_sponsor_id: number;
  event_id: number;
  corporate_id: number | null;
  contact_id: number | null;
  sponsor_level_id: number;
  sponsor_level_label: string;
  sponsor_level_sort: number;
  amount_pledged: number | string | null;
  amount_paid: number | string | null;
  acknowledged: boolean;
  notes: string | null;
  donation_id: number | null;
  donation_receipt_number: string | null;
  corporate_name: string | null;
  contact_name: string | null;
}

interface Detail {
  event: any;
  attendees: Array<{
    event_attendee_id: number;
    contact_id: number;
    rsvp_status: string | null;
    rsvp_status_id: number | null;
    rsvp_status_label: string | null;
    attended: boolean | null;
    amount_contributed: number | string | null;
    ticket_count: number;
    checked_in_at: string | null;
    notes: string | null;
    table_number: string | null;
    seat_number: string | null;
    dietary_notes: string | null;
    donation_id: number | null;
    donation_receipt_number: string | null;
    name: string;
    email: string | null;
    mobile_phone: string | null;
  }>;
  sponsors: SponsorRow[];
  prevId: number | null;
  nextId: number | null;
}

export function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<Detail>({
    queryKey: ['event', id],
    queryFn: () => apiGet(`/api/events/${id}`),
  });

  const checkInMut = useMutation({
    mutationFn: (attendeeId: number) => apiPost(`/api/events/${id}/check-in/${attendeeId}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
    onError: (err: any) => window.alert(err.message ?? 'Check-in failed'),
  });

  // Promote an attendee's contribution to a real tbl_donation row,
  // linked back via donation_id. Idempotent: server rejects if it's
  // already linked. Sensible defaults (donor auto-created if needed,
  // donation type = Cash, campaign = event's campaign).
  const promoteMut = useMutation({
    mutationFn: (attendeeId: number) =>
      apiPost<{ donation_id: number }>(`/api/events/${id}/attendees/${attendeeId}/promote-to-donation`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
    onError: (err: any) => window.alert(err.message ?? 'Promote failed'),
  });

  // Same idea for sponsors: promote a sponsorship commitment to a
  // real tbl_donation. Default to amount_paid if set, else
  // amount_pledged.
  const promoteSponsorMut = useMutation({
    mutationFn: (sponsorId: number) =>
      apiPost<{ donation_id: number }>(`/api/events/${id}/sponsors/${sponsorId}/promote-to-donation`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
    onError: (err: any) => window.alert(err.message ?? 'Promote sponsor failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate('/events');
    },
    onError: (err: any) => window.alert(err.message ?? 'Delete failed'),
  });

  function handleDelete() {
    if (window.confirm('Permanently delete this event and its attendee list?')) deleteMut.mutate();
  }

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const e = data.event;
  const totalContributed = data.attendees.reduce((s, a) => s + Number(a.amount_contributed ?? 0), 0);
  const checkedIn = data.attendees.filter(a => a.checked_in_at).length;

  return (
    <>
      <DetailNavBar
        listLabel="events" singularLabel="event" basePath="/events"
        prevId={data.prevId} nextId={data.nextId}
        actions={
          <>
            <Link to="/events/new" className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta">
              + New event
            </Link>
            <PrintMenu eventId={String(id)} />
            <Link to={`/events/${id}/check-in`} className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta">
              Day-of check-in →
            </Link>
            <Link to={`/events/${id}/edit`} className="btn-primary text-xs py-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </Link>
          </>
        }
      />

      <div className="flex gap-5 p-5 bg-cream border border-hairline rounded-[10px] mb-6">
        <div className="flex-1">
          <div className="flex items-baseline gap-3.5 mb-1 flex-wrap">
            <div className="font-display text-2xl font-medium">{e.event_name}</div>
            <span className="pill pill-terra">{e.event_type}</span>
            {e.campaign_name && <Link to={`/campaigns?search=${encodeURIComponent(e.campaign_name)}`} className="pill pill-muted hover:underline">{e.campaign_name}</Link>}
            {e.is_public && <span className="pill pill-sage">Public</span>}
          </div>
          <div className="flex gap-4 text-sm text-ink-soft flex-wrap">
            <span>{formatLongDate(e.event_date)}</span>
            {e.start_time && <><span>·</span><span>{formatTime(e.start_time)}{e.end_time && ` – ${formatTime(e.end_time)}`}</span></>}
            {e.address && <><span>·</span><span>{e.address}{e.address2 ? `, ${e.address2}` : ''}, {e.city}</span></>}
            {e.ticket_price != null && <><span>·</span><span>Tickets {formatMoney(e.ticket_price)}</span></>}
          </div>
          {/* Role + capacity strip — only renders if at least one
              of the new fields is populated. Keeps older events
              uncluttered. */}
          {(e.manager_name || e.host_contact_name || e.host_corporate_name || e.max_attendees != null) && (
            <div className="flex gap-4 text-[11px] text-ink-soft mt-2 flex-wrap">
              {e.manager_name && <span><span className="text-ink-faint uppercase tracking-widest">Manager </span>{e.manager_name}</span>}
              {(e.host_contact_name || e.host_corporate_name) && (
                <span><span className="text-ink-faint uppercase tracking-widest">Host </span>{e.host_corporate_name ?? e.host_contact_name}</span>
              )}
              {e.max_attendees != null && (
                <span>
                  <span className="text-ink-faint uppercase tracking-widest">Capacity </span>
                  {data.attendees.length}/{e.max_attendees}
                  {data.attendees.length >= e.max_attendees && (
                    <span className="ml-1 text-terracotta-deep font-medium">· full</span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-faint tracking-widest uppercase font-medium">Raised</div>
          <div className="font-display text-3xl font-medium leading-none">
            {e.amount_raised != null ? formatMoney(e.amount_raised) : formatMoney(totalContributed)}
          </div>
          {e.goal_amount != null && Number(e.goal_amount) > 0 && (
            <div className="text-[11px] text-ink-soft mt-1">Goal {formatMoney(e.goal_amount)}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat label="RSVPs" value={String(data.attendees.length)} />
        <Stat label="Checked in" value={String(checkedIn)} />
        <Stat label="Attended" value={String(data.attendees.filter(a => a.attended).length)} />
        <Stat label="Contributions" value={formatMoney(totalContributed)} />
      </div>

      <div className="card">
        <div className="card-head">
          <h3 className="font-display font-medium text-[17px] m-0">Attendees</h3>
          <span className="text-xs text-ink-faint">{data.attendees.length} total</span>
        </div>
        {data.attendees.length === 0 ? (
          <div className="text-sm text-ink-faint italic">No attendees yet. Add them via Edit.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>RSVP</Th>
                <Th className="text-right">Tickets</Th>
                <Th className="text-right">Contributed</Th>
                <Th>Status</Th>
                <Th>{' '}</Th>
              </tr>
            </thead>
            <tbody>
              {data.attendees.map(a => (
                <tr key={a.event_attendee_id} className="border-t border-hairline">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={a.name} />
                      <div>
                        <div className="font-medium text-sm">{a.name}</div>
                        <div className="text-[11px] text-ink-faint">{a.email ?? a.mobile_phone ?? '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-xs">{a.rsvp_status_label ?? a.rsvp_status ?? '—'}</td>
                  <td className="py-2.5 pr-3 text-right text-xs">{a.ticket_count}</td>
                  <td className="py-2.5 pr-3 text-right font-display font-medium text-sm">
                    <div>{a.amount_contributed != null ? formatMoney(a.amount_contributed) : '—'}</div>
                    {a.donation_id ? (
                      <Link
                        to={`/donations/${a.donation_id}`}
                        className="text-[10px] text-sage hover:text-terracotta-deep font-sans font-normal"
                      >
                        → Donation #{a.donation_id}{a.donation_receipt_number ? ` · ${a.donation_receipt_number}` : ''}
                      </Link>
                    ) : Number(a.amount_contributed ?? 0) > 0 ? (
                      <button
                        type="button"
                        onClick={() => promoteMut.mutate(a.event_attendee_id)}
                        disabled={promoteMut.isPending}
                        className="text-[10px] text-terracotta hover:text-terracotta-deep font-sans font-normal disabled:opacity-50"
                        title="Promote this contribution to a real donation (receipt-eligible, shows in donor lifetime giving)"
                      >
                        Convert to donation →
                      </button>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-3 text-xs">
                    {a.checked_in_at
                      ? <span className="text-sage">✓ Checked in</span>
                      : a.attended === false
                      ? <span className="text-terracotta-deep">No-show</span>
                      : <span className="text-ink-faint">Pending</span>}
                  </td>
                  <td className="py-2.5 text-right">
                    {!a.checked_in_at && (
                      <button
                        onClick={() => checkInMut.mutate(a.event_attendee_id)}
                        disabled={checkInMut.isPending}
                        className="text-xs text-terracotta hover:text-terracotta-deep disabled:opacity-50"
                      >
                        Check in
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sponsors — grouped by level, sorted Title → Bronze. */}
      {data.sponsors && data.sponsors.length > 0 && (
        <div className="card mt-5">
          <div className="card-head">
            <h3 className="font-display font-medium text-[17px] m-0">Sponsors</h3>
            <span className="text-xs text-ink-faint">{data.sponsors.length} total · {formatMoney(data.sponsors.reduce((s, x) => s + Number(x.amount_pledged ?? 0), 0))} pledged</span>
          </div>
          {(() => {
            const grouped: Record<string, SponsorRow[]> = {};
            const order: string[] = [];
            for (const s of data.sponsors) {
              if (!grouped[s.sponsor_level_label]) {
                grouped[s.sponsor_level_label] = [];
                order.push(s.sponsor_level_label);
              }
              grouped[s.sponsor_level_label].push(s);
            }
            return (
              <div className="space-y-3">
                {order.map(lvl => (
                  <div key={lvl}>
                    <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-1.5">{lvl}</div>
                    <div className="space-y-1.5">
                      {grouped[lvl].map(s => (
                        <div key={s.event_sponsor_id} className="flex items-baseline justify-between gap-3 flex-wrap py-1.5 border-b border-hairline last:border-b-0">
                          <div className="text-sm">
                            <span className="font-medium">{s.corporate_name ?? s.contact_name ?? '—'}</span>
                            {s.acknowledged && <span className="ml-2 text-[10px] text-sage uppercase tracking-widest">acknowledged</span>}
                            {s.notes && <span className="ml-2 text-[11px] text-ink-faint">{s.notes}</span>}
                          </div>
                          <div className="text-xs text-ink-soft flex items-baseline gap-3">
                            {s.amount_pledged != null && <span>{formatMoney(s.amount_pledged)} pledged</span>}
                            {s.amount_paid != null && s.amount_paid !== s.amount_pledged && <span className="text-ink-faint">{formatMoney(s.amount_paid)} paid</span>}
                            {s.donation_id ? (
                              <Link to={`/donations/${s.donation_id}`} className="text-sage hover:text-terracotta-deep">
                                → Donation #{s.donation_id}{s.donation_receipt_number ? ` · ${s.donation_receipt_number}` : ''}
                              </Link>
                            ) : (Number(s.amount_paid ?? s.amount_pledged ?? 0) > 0) ? (
                              <button
                                type="button"
                                onClick={() => promoteSponsorMut.mutate(s.event_sponsor_id)}
                                disabled={promoteSponsorMut.isPending}
                                className="text-terracotta hover:text-terracotta-deep disabled:opacity-50"
                                title="Promote this sponsorship to a real donation (counts toward lifetime giving + can generate a receipt)"
                              >
                                Convert to donation →
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Run-of-show + staff briefing — only render if populated. */}
      {(e.run_of_show || e.staff_briefing) && (
        <div className="card mt-5">
          <div className="card-head">
            <h3 className="font-display font-medium text-[17px] m-0">Schedule & briefing</h3>
          </div>
          {e.run_of_show && (
            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-1">Run of show</div>
              <div className="text-sm text-ink-soft whitespace-pre-line">{e.run_of_show}</div>
            </div>
          )}
          {e.staff_briefing && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-1">Staff briefing</div>
              <div className="text-sm text-ink-soft whitespace-pre-line">{e.staff_briefing}</div>
            </div>
          )}
        </div>
      )}

      {e.notes && (
        <div className="card mt-5">
          <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
            <h3 className="font-display font-medium text-sm m-0">Notes</h3>
          </div>
          <div className="text-sm text-ink-soft whitespace-pre-line">{e.notes}</div>
        </div>
      )}

      <button onClick={handleDelete} disabled={deleteMut.isPending}
        className="mt-5 text-xs text-terracotta hover:text-terracotta-deep disabled:opacity-50">
        {deleteMut.isPending ? 'Deleting…' : 'Delete this event'}
      </button>

      <div className="mt-5">
        <AttachmentsWidget entityType="event" entityId={Number(id)} title="Event documents (run-of-show, vendor contracts, photos)" />
      </div>
    </>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2 ${className}`}>{children}</th>;
}

/** Dropdown of print views for an event. Each item opens the print
 *  page in a new tab, which auto-launches the browser print dialog. */
function PrintMenu({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: Array<{ path: string; label: string; group?: string }> = [
    { group: 'Day-of',       path: 'door-roster',        label: 'Door check-in roster' },
    { group: 'Day-of',       path: 'run-of-show',        label: 'Run of show' },
    { group: 'Day-of',       path: 'staff-briefing',     label: 'Staff briefing card' },
    { group: 'Day-of',       path: 'walk-in-form',       label: 'Walk-in paper form' },
    { group: 'Sponsors',     path: 'sponsors',           label: 'Sponsor recognition sheet' },
    { group: 'Seating',      path: 'nametags',           label: 'Name badges (Avery 5395)' },
    { group: 'Seating',      path: 'table-cards',        label: 'Table cards (numbered tents)' },
    { group: 'Seating',      path: 'place-cards',        label: 'Place cards' },
    { group: 'Seating',      path: 'seating-chart',      label: 'Seating chart' },
    { group: 'Fundraising',  path: 'pledge-cards',       label: 'Pledge cards' },
    { group: 'Fundraising',  path: 'will-call-labels',   label: 'Will-call labels (Avery 5160)' },
  ];

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta"
      >
        Print ▾
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-72 max-h-96 overflow-y-auto bg-paper border border-hairline-strong rounded-md shadow-xl z-40 py-1.5">
          {Object.entries(groupBy(items, x => x.group ?? 'Other')).map(([grp, list]) => (
            <div key={grp}>
              <div className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-widest text-ink-faint font-medium">{grp}</div>
              {list.map(i => (
                <a
                  key={i.path}
                  href={`/events/${eventId}/print/${i.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-1.5 text-xs hover:bg-terracotta/[0.06]"
                  onClick={() => setOpen(false)}
                >
                  {i.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupBy<T, K extends string>(arr: T[], key: (x: T) => K): Record<K, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of arr) {
    const k = key(x);
    if (!out[k]) out[k] = [];
    out[k].push(x);
  }
  return out as Record<K, T[]>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium">{label}</div>
      <div className="font-display text-2xl font-medium leading-none mt-1">{value}</div>
    </div>
  );
}

function formatTime(t: string | null): string {
  if (!t) return '';
  const [hh, mm] = t.split(':');
  const h = Number(hh);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mm} ${ampm}`;
}
