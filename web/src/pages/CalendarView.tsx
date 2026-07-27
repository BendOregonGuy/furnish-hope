/**
 * Org-wide operations calendar. One unified view of pickups, deliveries,
 * fundraising events, campaigns, and client visits. Month / Week / Day
 * toggle in the header. Click any item → opens its detail page.
 *
 * Hover tooltips show key facts (address, status, visit type, etc.) so
 * staff don't always have to click through to know what's happening.
 *
 * Data comes from /api/calendar which returns items already in
 * FullCalendar's expected shape — date-range refetches as the user
 * navigates between months.
 */

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, DatesSetArg } from '@fullcalendar/core';
import { apiGet } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';

const VISIT_TYPE_OPTIONS = ['Delivery', 'Donation Center Pick Up', 'Selection of Items'];
const SELECTION_TYPE_OPTIONS = ['Guest Selection Appointment', 'Video Call Appointment', 'Volunteer Selection'];

interface CalendarItem {
  id: string;
  type: 'pickup' | 'delivery' | 'event' | 'campaign' | 'shift' | 'vendor_service' | 'visit';
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  url: string;
  color: string;
  meta: {
    status?: string;
    address?: string;
    city?: string;
    event_type?: string;
    mode?: string;
    visit_type?: string | null;
    selection_type?: string | null;
  };
}

export function CalendarView() {
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar>(null);
  // Track the visible date window — FullCalendar tells us via datesSet, and
  // we refetch the data when the user pages forward/back through months.
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(['pickup', 'delivery', 'event', 'campaign', 'visit']),
  );
  // Sub-filters for visits — only meaningful when the "Visits" type is on.
  const [visitTypes, setVisitTypes] = useState<Set<string>>(new Set(VISIT_TYPE_OPTIONS));
  const [selectionTypes, setSelectionTypes] = useState<Set<string>>(new Set(SELECTION_TYPE_OPTIONS));
  const visitsOn = visibleTypes.has('visit');

  const { data, isLoading, error, isFetching } = useQuery<{ items: CalendarItem[] }>({
    queryKey: ['calendar', range?.from, range?.to],
    queryFn: () => apiGet('/api/calendar', { from: range?.from, to: range?.to }),
    enabled: !!range,
  });

  // Filter the items by visible types (and, for visits, by the visit-type /
  // selection-type sub-filters) before handing them to FullCalendar.
  const events: EventInput[] = (data?.items ?? [])
    .filter(it => {
      if (!visibleTypes.has(it.type)) return false;
      if (it.type === 'visit') {
        const vt = it.meta.visit_type ?? null;
        const st = it.meta.selection_type ?? null;
        // Typed visits are hidden when their type/selection is deselected;
        // untyped (legacy) visits always pass the sub-filters.
        if (vt && !visitTypes.has(vt)) return false;
        if (st && !selectionTypes.has(st)) return false;
      }
      return true;
    })
    .map(it => ({
      id: it.id,
      title: it.title,
      start: it.start,
      end: it.end ?? undefined,
      allDay: it.allDay,
      backgroundColor: it.color,
      borderColor: it.color,
      extendedProps: {
        url: it.url,
        type: it.type,
        meta: it.meta,
      },
    }));

  function handleDatesSet(arg: DatesSetArg) {
    // arg.startStr / endStr come back as ISO timestamps. We only need the
    // date portion for the API query.
    const from = arg.startStr.slice(0, 10);
    const to   = arg.endStr.slice(0, 10);
    if (!range || range.from !== from || range.to !== to) {
      setRange({ from, to });
    }
  }

  function toggleType(t: string) {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  function toggleInSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        helpSection="calendar"
        title="Operations"
        emphasis="calendar"
        subtitle="Pickups, deliveries, events, campaigns, and client visits on one timeline. Click any item to open it."
      />

      {/* Legend / filter chips */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TypeChip color="#C7704A" type="pickup"   visible={visibleTypes.has('pickup')}   onToggle={toggleType}>Pickups</TypeChip>
        <TypeChip color="#7C8B5E" type="delivery" visible={visibleTypes.has('delivery')} onToggle={toggleType}>Deliveries</TypeChip>
        <TypeChip color="#C9A24E" type="event"    visible={visibleTypes.has('event')}    onToggle={toggleType}>Events</TypeChip>
        <TypeChip color="#5B6478" type="campaign" visible={visibleTypes.has('campaign')} onToggle={toggleType}>Campaigns</TypeChip>
        <TypeChip color="#A5644E" type="visit"    visible={visitsOn}                     onToggle={toggleType}>Visits</TypeChip>
        {isFetching && <span className="text-[11px] text-ink-faint ml-2 italic">Loading…</span>}
      </div>

      {/* Visit sub-filters — enabled only when "Visits" is selected. */}
      <div
        className={`mb-4 rounded-md border border-hairline bg-cream/40 px-3 py-2.5 transition ${
          visitsOn ? '' : 'opacity-50 pointer-events-none select-none'
        }`}
        aria-disabled={!visitsOn}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mr-1">Visit type</span>
          {VISIT_TYPE_OPTIONS.map(t => (
            <SubChip key={t} label={t} active={visitTypes.has(t)} disabled={!visitsOn}
              onToggle={() => toggleInSet(setVisitTypes, t)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-2">
          <span className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mr-1">Selection type</span>
          {SELECTION_TYPE_OPTIONS.map(t => (
            <SubChip key={t} label={t} active={selectionTypes.has(t)} disabled={!visitsOn}
              onToggle={() => toggleInSet(setSelectionTypes, t)} />
          ))}
        </div>
        {!visitsOn && (
          <div className="text-[11px] text-ink-faint italic mt-2">Turn on “Visits” above to filter by visit type or selection type.</div>
        )}
      </div>

      {error && <ErrorBox error={error} />}
      {isLoading && !data && <Loading />}

      {/* Calendar shell with our project styling applied via the wrapper.
          Heights are explicit so the calendar doesn't collapse to nothing
          inside the flex layout. */}
      <div className="bg-paper border border-hairline rounded-lg p-3 fh-calendar">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          buttonText={{
            today: 'Today',
            month: 'Month',
            week:  'Week',
            day:   'Day',
            list:  'Agenda',
          }}
          height="auto"
          contentHeight={620}
          events={events}
          datesSet={handleDatesSet}
          eventClick={(arg) => {
            arg.jsEvent.preventDefault();
            const url = arg.event.extendedProps.url as string | undefined;
            if (url) navigate(url);
          }}
          eventDidMount={(arg) => {
            // Tooltip with the extra meta on hover.
            const meta = arg.event.extendedProps.meta as CalendarItem['meta'] | undefined;
            const lines: string[] = [arg.event.title];
            if (meta?.status) lines.push(`Status: ${meta.status}`);
            if (meta?.event_type) lines.push(`Type: ${meta.event_type}`);
            if (meta?.visit_type) lines.push(`Visit type: ${meta.visit_type}`);
            if (meta?.selection_type) lines.push(`Selection: ${meta.selection_type}`);
            if (meta?.address) lines.push(`${meta.address}${meta.city ? `, ${meta.city}` : ''}`);
            arg.el.title = lines.join('\n');
          }}
          firstDay={0} // Sunday
          dayMaxEvents={4}
          nowIndicator
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          weekends
        />
      </div>

      {/* Project-flavored overrides for FullCalendar's default chrome.
          Kept inline so the override only loads on this page. */}
      <style>{`
        .fh-calendar .fc-toolbar-title { font-family: 'Spectral', Georgia, serif; font-weight: 500; }
        .fh-calendar .fc-button {
          background-color: transparent !important;
          color: var(--ink-soft, #4a443a) !important;
          border: 1px solid var(--hairline-strong, #d8d4cc) !important;
          font-size: 12px !important;
          padding: 4px 10px !important;
          font-weight: 500 !important;
          text-transform: none !important;
          box-shadow: none !important;
        }
        .fh-calendar .fc-button:hover {
          color: #C7704A !important;
          border-color: #C7704A !important;
        }
        .fh-calendar .fc-button-active,
        .fh-calendar .fc-button-primary:not(:disabled).fc-button-active {
          background-color: #C7704A !important;
          color: white !important;
          border-color: #C7704A !important;
        }
        .fh-calendar .fc-event { cursor: pointer; }
        .fh-calendar .fc-daygrid-day-number,
        .fh-calendar .fc-col-header-cell-cushion {
          color: var(--ink, #1a1611);
          text-decoration: none;
        }
        .fh-calendar .fc-day-today { background-color: rgba(199, 112, 74, 0.05) !important; }
      `}</style>
    </>
  );
}

/* ----------------------------------------------------------------- */
/*  Legend / filter chip (event type)                                 */
/* ----------------------------------------------------------------- */

function TypeChip({
  color, type, visible, onToggle, children,
}: {
  color: string; type: string; visible: boolean;
  onToggle: (t: string) => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(type)}
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition ${
        visible
          ? 'border-hairline-strong text-ink bg-paper'
          : 'border-hairline text-ink-faint bg-cream line-through'
      }`}
      title={visible ? `Hide ${children}` : `Show ${children}`}
    >
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color, opacity: visible ? 1 : 0.4 }} />
      {children}
    </button>
  );
}

/* Small on/off chip for the visit sub-filters. */
function SubChip({
  label, active, disabled, onToggle,
}: {
  label: string; active: boolean; disabled?: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`text-xs px-2.5 py-1 rounded-full border transition ${
        active
          ? 'bg-terracotta text-paper border-terracotta'
          : 'bg-paper text-ink-soft border-hairline-strong'
      } ${disabled ? 'cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  );
}
