/**
 * Events list — fundraising galas, awareness events, volunteer days, etc.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, formatMoney, formatLongDate } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox, EmptyState } from '../components/ui.tsx';

interface EventRow {
  event_id: number;
  event_name: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string;
  campaign_name: string | null;
  venue: string | null;
  goal_amount: number | string | null;
  amount_raised: number | string | null;
  ticket_price: number | string | null;
  is_public: boolean;
  attendee_count: number;
  attended_count: number;
}

export function Events() {
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, error } = useQuery<EventRow[]>({
    queryKey: ['events', showAll],
    queryFn: () => apiGet('/api/events', { upcoming: showAll ? undefined : 'true' }),
  });

  return (
    <>
      <PageHeader
        title="Events"
        emphasis="& fundraisers"
        subtitle="Galas, volunteer days, donor appreciation, awareness events — anything where people show up."
        actions={
          <Link to="/events/new" className="btn-primary">
            <span className="text-base leading-none">+</span> New event
          </Link>
        }
      />

      <div className="flex gap-2 mb-5">
        <Toggle active={!showAll} onClick={() => setShowAll(false)} label="Upcoming" />
        <Toggle active={showAll} onClick={() => setShowAll(true)} label="All events" />
      </div>

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && data.length === 0 && (
        <EmptyState
          title={showAll ? 'No events yet' : 'No upcoming events'}
          hint={showAll ? 'Click "New event" to schedule one.' : 'Toggle "All events" to see past ones.'}
        />
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map(e => (
            <Link key={e.event_id} to={`/events/${e.event_id}`}
              className="card hover:border-terracotta transition block">
              <div className="flex items-baseline justify-between mb-1 gap-2">
                <div className="font-display font-medium text-lg leading-tight">{e.event_name}</div>
                {e.is_public && <span className="pill pill-sage text-[9px] py-0">Public</span>}
              </div>
              <div className="text-[11px] text-ink-faint mb-3">
                {e.event_type}
                {e.campaign_name && <> · for {e.campaign_name}</>}
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium">When</div>
                  <div className="text-ink mt-0.5">{formatLongDate(e.event_date)}</div>
                  {e.start_time && <div className="text-ink-soft text-[11px]">{formatTime(e.start_time)}{e.end_time && `–${formatTime(e.end_time)}`}</div>}
                </div>
                <div>
                  <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium">Attendees</div>
                  <div className="text-ink mt-0.5">{e.attendee_count}</div>
                  {e.attended_count > 0 && <div className="text-ink-soft text-[11px]">{e.attended_count} attended</div>}
                </div>
                <div>
                  <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium">Raised</div>
                  <div className="font-display font-medium text-ink mt-0.5">
                    {e.amount_raised != null ? formatMoney(e.amount_raised) : '—'}
                  </div>
                  {e.goal_amount != null && Number(e.goal_amount) > 0 && (
                    <div className="text-ink-soft text-[11px]">of {formatMoney(e.goal_amount)}</div>
                  )}
                </div>
              </div>
              {e.venue && <div className="text-[11px] text-ink-faint mt-2">{e.venue}</div>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button" onClick={onClick}
      className={
        'text-xs px-3 py-1.5 rounded-md border transition ' +
        (active ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-soft border-hairline-strong hover:border-ink')
      }
    >
      {label}
    </button>
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
