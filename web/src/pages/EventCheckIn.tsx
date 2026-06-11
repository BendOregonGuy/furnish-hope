/**
 * Day-of check-in view at /events/:id/check-in. Designed for a tablet
 * at the door — big tappable rows, fast filter, walk-in button, no
 * editing surface (use /events/:id/edit for that).
 *
 * One tap on an unchecked row stamps checked_in_at via the existing
 * POST /api/events/:id/check-in/:attendeeId endpoint. The "+ Walk-in"
 * button opens a quick form that atomically creates a contact + the
 * attendee row + the check-in via POST /api/events/:id/walk-in.
 *
 * Email is OPTIONAL for walk-ins (typical — people don't volunteer
 * their email at the door). For pre-registered attendees, the email
 * requirement applies upstream at attendee-create time.
 */

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, formatLongDate, formatMoney } from '../lib/api.ts';
import { Loading, ErrorBox, Avatar } from '../components/ui.tsx';
import { FkSelect } from '../components/admin/FkSelect.tsx';

interface Attendee {
  event_attendee_id: number;
  contact_id: number;
  rsvp_status_label: string | null;
  attended: boolean | null;
  amount_contributed: number | string | null;
  ticket_count: number;
  checked_in_at: string | null;
  name: string;
  email: string | null;
  mobile_phone: string | null;
}

interface Detail {
  event: any;
  attendees: Attendee[];
}

export function EventCheckIn() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [showOnly, setShowOnly] = useState<'all' | 'in' | 'out'>('all');
  const [walkInOpen, setWalkInOpen] = useState(false);

  const { data, isLoading, error } = useQuery<Detail>({
    queryKey: ['event', id],
    queryFn: () => apiGet(`/api/events/${id}`),
  });

  const checkInMut = useMutation({
    mutationFn: (attendeeId: number) => apiPost(`/api/events/${id}/check-in/${attendeeId}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
    onError: (err: any) => window.alert(err.message ?? 'Check-in failed'),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    return data.attendees.filter(a => {
      if (showOnly === 'in' && !a.checked_in_at) return false;
      if (showOnly === 'out' && a.checked_in_at) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.email ?? '').toLowerCase().includes(q) ||
        (a.mobile_phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, filter, showOnly]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const e = data.event;
  const total = data.attendees.length;
  const checkedIn = data.attendees.filter(a => a.checked_in_at).length;

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <Link to={`/events/${id}`} className="text-xs text-terracotta hover:text-terracotta-deep">
            ← Back to event detail
          </Link>
          <h1 className="font-display text-2xl font-medium m-0 mt-1">{e.event_name}</h1>
          <div className="text-sm text-ink-soft">{formatLongDate(e.event_date)}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-4xl font-medium leading-none">
            {checkedIn}<span className="text-ink-faint text-2xl"> / {total}</span>
          </div>
          <div className="text-[11px] uppercase tracking-widest text-ink-faint font-medium mt-1">Checked in</div>
        </div>
      </div>

      <div className="card mb-4 sticky top-2 z-10 bg-paper shadow-md">
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="search"
            placeholder="Search name, email, phone…"
            value={filter}
            onChange={ev => setFilter(ev.target.value)}
            className="field-input flex-1 min-w-[200px] text-base py-3"
            autoFocus
          />
          <div className="flex border border-hairline-strong rounded-md overflow-hidden">
            {(['all', 'out', 'in'] as const).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setShowOnly(k)}
                className={`px-3 py-2 text-xs ${showOnly === k ? 'bg-terracotta text-paper' : 'bg-paper hover:bg-cream'}`}
              >
                {k === 'all' ? 'All' : k === 'in' ? 'Checked in' : 'Not yet'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setWalkInOpen(true)}
            className="btn-primary text-sm whitespace-nowrap"
          >
            + Walk-in
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-sm text-ink-faint italic text-center py-10">
          {filter.trim() ? `No matches for "${filter}".` : 'No attendees in this view.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => (
            <CheckInRow
              key={a.event_attendee_id}
              attendee={a}
              onCheckIn={() => checkInMut.mutate(a.event_attendee_id)}
              busy={checkInMut.isPending && checkInMut.variables === a.event_attendee_id}
            />
          ))}
        </div>
      )}

      {walkInOpen && (
        <WalkInModal
          eventId={Number(id)}
          onClose={() => setWalkInOpen(false)}
          onCreated={() => {
            setWalkInOpen(false);
            queryClient.invalidateQueries({ queryKey: ['event', id] });
          }}
        />
      )}
    </>
  );
}

function CheckInRow({ attendee, onCheckIn, busy }: { attendee: Attendee; onCheckIn: () => void; busy: boolean }) {
  const checked = !!attendee.checked_in_at;
  return (
    <button
      type="button"
      onClick={checked || busy ? undefined : onCheckIn}
      disabled={checked || busy}
      className={`w-full text-left card flex items-center gap-3 transition-colors ${
        checked
          ? 'bg-sage-soft/40 border-sage'
          : 'hover:bg-terracotta/5 cursor-pointer'
      }`}
    >
      <Avatar name={attendee.name} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-base truncate">{attendee.name}</div>
        <div className="text-xs text-ink-soft truncate">
          {attendee.email ?? attendee.mobile_phone ?? '—'}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {attendee.rsvp_status_label && (
          <span className="pill pill-muted text-[10px]">{attendee.rsvp_status_label}</span>
        )}
        {attendee.amount_contributed != null && Number(attendee.amount_contributed) > 0 && (
          <span className="text-xs text-ink-soft">{formatMoney(attendee.amount_contributed)}</span>
        )}
        {checked ? (
          <span className="text-sage text-sm font-medium whitespace-nowrap">
            ✓ {new Date(attendee.checked_in_at!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        ) : (
          <span className="text-terracotta font-medium text-sm whitespace-nowrap">
            {busy ? 'Checking in…' : 'Tap to check in'}
          </span>
        )}
      </div>
    </button>
  );
}

function WalkInModal({
  eventId, onClose, onCreated,
}: { eventId: number; onClose: () => void; onCreated: () => void }) {
  const [first, setFirst]     = useState('');
  const [last, setLast]       = useState('');
  const [email, setEmail]     = useState('');
  const [phone, setPhone]     = useState('');
  const [typeId, setTypeId]   = useState<number | null>(null);
  const [amount, setAmount]   = useState('');
  const [tickets, setTickets] = useState(1);
  const [notes, setNotes]     = useState('');
  const [err, setErr]         = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => apiPost('/api/events/' + eventId + '/walk-in', {
      first_name: first.trim(),
      last_name: last.trim(),
      email: email.trim() || null,
      mobile_phone: phone.trim() || null,
      contact_type_id: typeId,
      amount_contributed: amount === '' ? null : Number(amount),
      ticket_count: tickets,
      notes: notes.trim() || null,
    }),
    onSuccess: () => onCreated(),
    onError: (e: any) => setErr(e.message ?? 'Walk-in failed'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setErr(null);
    const missing: string[] = [];
    if (!first.trim()) missing.push('First name');
    if (!last.trim())  missing.push('Last name');
    if (!typeId)       missing.push('Type');
    if (missing.length) { setErr(`Required: ${missing.join(', ')}`); return; }
    mut.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-start justify-center pt-16 pb-10 overflow-y-auto" onClick={onClose}>
      <div className="bg-paper rounded-lg shadow-2xl border border-hairline w-[640px] max-w-[calc(100vw-32px)]" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}>
          <div className="p-5 border-b border-hairline">
            <h3 className="font-display text-lg font-medium m-0">Walk-in attendee</h3>
            <p className="text-xs text-ink-faint mt-1">
              Capture as little or as much as you can. Email is optional for walk-ins — you can fill it in later if they give it to you.
            </p>
          </div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">First name <span className="text-terracotta">*</span></label>
                <input type="text" className="field-input" value={first} onChange={e => setFirst(e.target.value)} maxLength={50} autoFocus required />
              </div>
              <div>
                <label className="field-label">Last name <span className="text-terracotta">*</span></label>
                <input type="text" className="field-input" value={last} onChange={e => setLast(e.target.value)} maxLength={50} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Contact type <span className="text-terracotta">*</span></label>
                <FkSelect fkTable="lkp_contact_type" value={typeId} onChange={setTypeId} required />
              </div>
              <div>
                <label className="field-label">Mobile phone</label>
                <input type="tel" className="field-input" value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} />
              </div>
            </div>
            <div>
              <label className="field-label">Email</label>
              <input type="email" className="field-input" value={email} onChange={e => setEmail(e.target.value)} maxLength={100} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Tickets</label>
                <input type="number" min={1} className="field-input" value={tickets} onChange={e => setTickets(Number(e.target.value) || 1)} />
              </div>
              <div>
                <label className="field-label">Contribution ($)</label>
                <input type="number" step="0.01" min="0" className="field-input" placeholder="$" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label">Notes</label>
              <input type="text" className="field-input" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            {err && <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded text-xs">{err}</div>}
          </div>
          <div className="p-4 border-t border-hairline flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={mut.isPending} className="btn-primary disabled:opacity-60">
              {mut.isPending ? 'Adding…' : 'Add + check in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
