/**
 * Read-only detail for a Donation Pickup.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, formatLongDate } from '../lib/api.ts';
import { Avatar, Loading, ErrorBox, StatusPill } from '../components/ui.tsx';
import { DetailNavBar } from '../components/forms/FormNavBar.tsx';

type Detail = {
  pickup: any;
  prevId: number | null;
  nextId: number | null;
};

export function PickupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<Detail>({
    queryKey: ['pickup', id],
    queryFn: () => apiGet(`/api/pickups/${id}`),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/pickups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickups'] });
      navigate('/pickups');
    },
    onError: (err: any) => window.alert(err.message ?? 'Delete failed'),
  });

  function handleDelete() {
    if (window.confirm('Permanently delete this pickup? This cannot be undone.')) deleteMut.mutate();
  }

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const p = data.pickup;

  return (
    <>
      <DetailNavBar
        listLabel="pickups" singularLabel="pickup" basePath="/pickups"
        prevId={data.prevId} nextId={data.nextId}
        actions={
          <>
            <Link to="/pickups/new" className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta">+ New pickup</Link>
            <a
              href={`/pickups/${id}/manifest`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta inline-flex items-center gap-1"
              title="Open a print-ready manifest in a new tab"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print manifest
            </a>
            <Link to={`/pickups/${id}/edit`} className="btn-primary text-xs py-1.5">
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
        <Avatar name={p.donor_name} size="lg" />
        <div className="flex-1">
          <div className="flex items-baseline gap-3.5 mb-1">
            <div className="font-display text-2xl font-medium">{p.donor_name}</div>
            <StatusPill status={p.pickup_status} />
            <span className="text-xs text-ink-faint">Pickup #{p.pickup_id}</span>
          </div>
          <div className="flex gap-4 text-sm text-ink-soft flex-wrap">
            <span>{p.address}{p.address2 ? `, ${p.address2}` : ''}, {p.city} {p.postalcode}</span>
            {p.donor_phone && <><span>·</span><span>{p.donor_phone}</span></>}
            {p.donor_email && <><span>·</span><span>{p.donor_email}</span></>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-faint tracking-widest uppercase font-medium">Scheduled</div>
          <div className="font-display text-xl font-medium">{formatLongDate(p.scheduled_date)}</div>
          {p.time_window_start && (
            <div className="text-xs text-ink-soft">{formatTime(p.time_window_start)}–{formatTime(p.time_window_end)}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-5">
        <div className="card">
          <div className="card-head"><h3 className="font-display font-medium text-[17px] m-0">Access notes</h3></div>
          {p.access_notes
            ? <div className="text-sm text-ink-soft whitespace-pre-line">{p.access_notes}</div>
            : <div className="text-sm text-ink-faint italic">No special notes.</div>}
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Crew & vehicle</h3>
            </div>
            <Detail label="Lead" value={p.team_lead ?? 'Unassigned'} />
            <Detail label="Vehicle" value={p.vehicle_license ?? 'Unassigned'} />
          </div>

          <button onClick={handleDelete} disabled={deleteMut.isPending}
            className="text-xs text-terracotta hover:text-terracotta-deep disabled:opacity-50 self-start">
            {deleteMut.isPending ? 'Deleting…' : 'Delete this pickup'}
          </button>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2 py-1 text-xs">
      <div className="text-ink-faint uppercase tracking-wider text-[10px] font-medium">{label}</div>
      <div className="text-ink">{value}</div>
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
