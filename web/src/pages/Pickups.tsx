import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, formatLongDate } from '../lib/api.ts';
import { PageHeader, StatusPill, Avatar, Loading, ErrorBox, EmptyState, AnonPill } from '../components/ui.tsx';

type Pickup = {
  pickup_id: number;
  scheduled_date: string;
  time_window_start: string | null;
  time_window_end: string | null;
  pickup_status: string;
  donor_name: string;
  is_anonymous: boolean;
  donor_type: string;
  address: string;
  city: string | null;
  access_notes: string | null;
  vehicle_license: string | null;
  team_lead: string | null;
};

export function Pickups() {
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, error } = useQuery<Pickup[]>({
    queryKey: ['pickups', showAll],
    queryFn: () => apiGet('/api/pickups', { upcoming: showAll ? undefined : 'true' }),
  });

  return (
    <>
      <PageHeader
        helpSection="pickups"
        title="Donation"
        emphasis="pickups"
        subtitle="Furniture pickups scheduled from donor homes. Routes, vehicles, access notes — all in one place."
        actions={
          <Link to="/pickups/new" className="btn-primary">
            <span className="text-base leading-none">+</span> Schedule pickup
          </Link>
        }
      />

      <div className="flex gap-2 mb-5">
        <Toggle active={!showAll} onClick={() => setShowAll(false)} label="Upcoming" />
        <Toggle active={showAll} onClick={() => setShowAll(true)} label="All pickups" />
      </div>

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && data.length === 0 && <EmptyState title="No pickups scheduled" hint="When you schedule one it'll show up here." />}
      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map(p => (
            <Link key={p.pickup_id} to={`/pickups/${p.pickup_id}`} className="card grid grid-cols-[120px_1fr_1fr_180px] gap-5 items-start hover:border-hairline-strong transition">
              <div>
                <div className="text-[11px] tracking-widest uppercase text-ink-faint font-medium mb-1">Pickup</div>
                <div className="font-display font-medium text-base">{formatLongDate(p.scheduled_date)}</div>
                {p.time_window_start && (
                  <div className="text-xs text-ink-soft mt-0.5">
                    {formatTime(p.time_window_start)}–{formatTime(p.time_window_end)}
                  </div>
                )}
                <div className="mt-2"><StatusPill status={p.pickup_status} /></div>
              </div>

              <div>
                <div className="text-[11px] tracking-widest uppercase text-ink-faint font-medium mb-1">Donor</div>
                <div className="flex items-center gap-2.5">
                  <Avatar name={p.donor_name} />
                  <div>
                    <div className="font-medium flex items-center gap-1.5 flex-wrap">
                      {p.donor_name}
                      {p.is_anonymous && <AnonPill />}
                    </div>
                    <div className="text-[11px] text-ink-faint">{p.donor_type}</div>
                  </div>
                </div>
                <div className="text-xs text-ink-soft mt-2">{p.address}{p.city ? `, ${p.city}` : ''}</div>
              </div>

              <div>
                <div className="text-[11px] tracking-widest uppercase text-ink-faint font-medium mb-1">Access notes</div>
                <div className="text-sm text-ink-soft italic">
                  {p.access_notes ?? <span className="text-ink-faint not-italic">No special notes.</span>}
                </div>
              </div>

              <div>
                <div className="text-[11px] tracking-widest uppercase text-ink-faint font-medium mb-1">Crew</div>
                <div className="text-sm">{p.team_lead ?? <span className="text-ink-faint">Unassigned</span>}</div>
                <div className="text-xs text-ink-soft mt-0.5">{p.vehicle_license ? `Vehicle ${p.vehicle_license}` : 'No vehicle yet'}</div>
              </div>
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
      type="button"
      onClick={onClick}
      className={
        'text-xs px-3 py-1.5 rounded-md border transition ' +
        (active
          ? 'bg-ink text-paper border-ink'
          : 'bg-paper text-ink-soft border-hairline-strong hover:border-ink')
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
