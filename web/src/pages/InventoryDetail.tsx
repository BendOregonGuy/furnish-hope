/**
 * Read-only detail view for an inventory item. Shows classification,
 * placement, value, lifecycle, and any reservations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, formatMoney, formatLongDate } from '../lib/api.ts';
import { Loading, ErrorBox, StatusPill } from '../components/ui.tsx';
import { DetailNavBar } from '../components/forms/FormNavBar.tsx';

type Detail = {
  item: any;
  reservations: any[];
  prevId: number | null;
  nextId: number | null;
};

export function InventoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<Detail>({
    queryKey: ['inventory-item', id],
    queryFn: () => apiGet(`/api/inventory/${id}`),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      navigate('/inventory');
    },
    onError: (err: any) => window.alert(err.message ?? 'Delete failed'),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const it = data.item;
  const status = it.date_dispositioned ? 'Out' : (data.reservations.some((r: any) => r.reservation_status === 'Active') ? 'Reserved' : 'Available');

  function handleDelete() {
    if (window.confirm('Permanently delete this inventory item? This cannot be undone.')) deleteMut.mutate();
  }

  return (
    <>
      <DetailNavBar
        listLabel="inventory" singularLabel="item" basePath="/inventory"
        prevId={data.prevId} nextId={data.nextId}
        actions={
          <>
            <Link to="/inventory/new" className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta">
              + New item
            </Link>
            <Link to={`/inventory/${id}/edit`} className="btn-primary text-xs py-1.5">
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
          <div className="flex items-baseline gap-3.5 mb-1">
            <div className="font-display text-2xl font-medium">{it.description || it.item_category}</div>
            <span className="pill pill-terra">{it.item_category}</span>
            <StatusPill status={status} />
          </div>
          <div className="flex gap-4 text-sm text-ink-soft flex-wrap">
            <span>{it.item_condition ?? '—'} condition</span>
            <span>·</span>
            <span>{it.item_size ?? '—'}</span>
            <span>·</span>
            <span>{it.facility_name}{it.location_code ? ` · ${it.location_code}` : ''}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-faint tracking-widest uppercase font-medium">Intake value</div>
          <div className="font-display text-2xl font-medium leading-none">{formatMoney(it.donation_value_in)}</div>
          {it.donation_value_out != null && (
            <div className="text-xs text-ink-soft mt-1">Out: {formatMoney(it.donation_value_out)}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-5">
        <div className="space-y-4">
          <div className="card">
            <div className="card-head"><h3 className="font-display font-medium text-[17px] m-0">Reservations</h3></div>
            {data.reservations.length === 0 ? (
              <div className="text-xs text-ink-faint py-2">Not currently reserved.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Client</th>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Reserved</th>
                    <th className="text-left text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reservations.map(r => (
                    <tr key={r.inventory_reservation_id} className="border-t border-hairline">
                      <td className="py-2.5 pr-3">
                        <Link to={`/requests/${r.request_id}`} className="text-terracotta font-medium">{r.client_name}</Link>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{formatLongDate(r.reserved_at)}</td>
                      <td className="py-2.5"><StatusPill status={r.reservation_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Lifecycle</h3>
            </div>
            <Detail label="Received" value={formatLongDate(it.date_added_to_inventory)} />
            <Detail label="Out" value={it.date_dispositioned ? formatLongDate(it.date_dispositioned) : '—'} />
            <Detail label="Reason" value={it.disposition_reason ?? '—'} />
          </div>

          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Details</h3>
            </div>
            <Detail label="Weight" value={it.item_weight ?? '—'} />
            <Detail label="Facility" value={it.facility_name} />
            <Detail label="Location" value={it.location_code ?? '—'} />
          </div>

          <button onClick={handleDelete} disabled={deleteMut.isPending}
            className="text-xs text-terracotta hover:text-terracotta-deep disabled:opacity-50 self-start">
            {deleteMut.isPending ? 'Deleting…' : 'Delete this item'}
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
