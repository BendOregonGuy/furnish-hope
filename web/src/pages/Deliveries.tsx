import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiGet, formatShortDate } from '../lib/api.ts';
import { PageHeader, StatusPill, Avatar, Loading, ErrorBox, EmptyState } from '../components/ui.tsx';

type Delivery = {
  delivery_id: number;
  delivery_date: string;
  time_arrival_earliest: string | null;
  time_arrival_latest: string | null;
  time_delivery_complete: string | null;
  delivery_status: string;
  client_id: number;
  client_name: string;
  address: string | null;
  city: string | null;
  item_count: number;
  team_lead: string | null;
  vehicle_license: string | null;
  has_receipt: boolean;
};

export function Deliveries() {
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, error } = useQuery<Delivery[]>({
    queryKey: ['deliveries', showAll],
    queryFn: () => apiGet('/api/deliveries', { upcoming: showAll ? undefined : 'true' }),
  });

  return (
    <>
      <PageHeader
        helpSection="deliveries"
        title="Scheduled"
        emphasis="deliveries"
        subtitle="Crews, vehicles, and timing for each home delivery. Sign-off completes the Cycle of Hope."
        actions={
          <Link to="/deliveries/new" className="btn-primary">
            <span className="text-base leading-none">+</span> Schedule delivery
          </Link>
        }
      />

      <div className="flex gap-2 mb-5">
        <Toggle active={!showAll} onClick={() => setShowAll(false)} label="Upcoming" />
        <Toggle active={showAll} onClick={() => setShowAll(true)} label="All deliveries" />
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading && <Loading />}
        {error && <ErrorBox error={error} />}
        {data && data.length === 0 && <EmptyState title="No deliveries to show" hint="When you schedule a delivery it'll appear here." />}
        {data && data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-cream">
              <tr>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Date</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Client</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Items</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Crew lead</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Vehicle</th>
                <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.delivery_id} className="border-t border-hairline hover:bg-terracotta/[0.025]">
                  <td className="px-5 py-3">
                    <Link to={`/deliveries/${d.delivery_id}`} className="text-terracotta font-medium">
                      {formatShortDate(d.delivery_date)}
                    </Link>
                    {d.time_arrival_earliest && (
                      <div className="text-[11px] text-ink-faint">
                        {formatTime(d.time_arrival_earliest)}–{formatTime(d.time_arrival_latest)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={d.client_name} />
                      <div>
                        <div className="font-medium">{d.client_name}</div>
                        <div className="text-[11px] text-ink-faint">{d.address ? `${d.address}, ${d.city}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-soft">{d.item_count} loaded</td>
                  <td className="px-5 py-3 text-xs">{d.team_lead ?? '—'}</td>
                  <td className="px-5 py-3 text-xs">{d.vehicle_license ?? '—'}</td>
                  <td className="px-5 py-3">
                    <StatusPill status={d.delivery_status} />
                    {d.has_receipt && <span className="ml-2 text-[10px] text-sage">✓ signed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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

/** "09:00:00" → "9:00 AM" */
function formatTime(t: string | null): string {
  if (!t) return '';
  const [hh, mm] = t.split(':');
  const h = Number(hh);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mm} ${ampm}`;
}
