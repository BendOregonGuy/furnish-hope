import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiGet, formatMoney, formatLongDate } from '../lib/api.ts';
import { Avatar, Loading, ErrorBox } from '../components/ui.tsx';
import { DetailNavBar } from '../components/forms/FormNavBar.tsx';
import { AttachmentsWidget } from '../components/attachments/AttachmentsWidget.tsx';

type Detail = {
  request: any;
  items: Array<any>;
  matches: Array<any>;
  prevId: number | null;
  nextId: number | null;
};

export function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<Detail>({
    queryKey: ['request', id],
    queryFn: () => apiGet(`/api/requests/${id}`),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      navigate('/requests');
    },
    onError: (err: any) => window.alert(err.message ?? 'Delete failed'),
  });

  function handleDelete() {
    if (window.confirm('Permanently delete this provisioning request and its items? This cannot be undone.')) {
      deleteMut.mutate();
    }
  }

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const { request, items, matches } = data;

  return (
    <>
      <DetailNavBar
        listLabel="requests" singularLabel="request" basePath="/requests"
        prevId={data.prevId} nextId={data.nextId}
        actions={
          <>
            <Link
              to="/requests/new"
              className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta"
            >
              + New request
            </Link>
            <Link to={`/requests/${id}/edit`} className="btn-primary text-xs py-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </Link>
          </>
        }
      />

      {/* Client header card */}
      <div className="flex gap-5 p-5 bg-cream border border-hairline rounded-[10px] mb-6">
        <Avatar name={request.client_name} size="lg" />
        <div className="flex-1">
          <div className="flex items-baseline gap-3.5 mb-1">
            <div className="font-display text-2xl font-medium">{request.client_name}</div>
            <span className="pill pill-terra">{request.client_type}</span>
            <span className="text-xs text-ink-faint">Request #{request.request_id} · {formatLongDate(request.request_at)}</span>
          </div>
          <div className="flex gap-4 text-sm text-ink-soft flex-wrap">
            {request.address && <span>{request.address}, {request.city}</span>}
            {request.agency_name && <><span>·</span><span>Referred by <span className="text-ink font-medium">{request.agency_name}</span></span></>}
            <span>·</span>
            <span>Fulfilling from <span className="text-ink font-medium">{request.fulfillment_facility}</span></span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-faint tracking-widest uppercase font-medium">Reserved value</div>
          <div className="font-display text-3xl font-medium leading-none">{formatMoney(request.reserved_value)}</div>
          <div className="text-[11px] text-ink-soft mt-1">{matches.length} items reserved</div>
        </div>
      </div>

      {request.client_request_note && (
        <div className="bg-cream-deep border-l-[3px] border-terracotta rounded-md p-4 mb-6 text-sm text-ink-soft italic">
          <span className="font-display not-italic font-medium text-ink">Caseworker note —</span> {request.client_request_note}
        </div>
      )}

      <div className="grid grid-cols-[1fr_320px] gap-5">
        <div className="card">
          <div className="card-head">
            <h3 className="font-display font-medium text-[17px] m-0">Requested items</h3>
            <div className="flex gap-1.5">
              <span className="pill pill-sage">{matches.length} matched</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_60px_90px_140px] gap-3 text-[11px] tracking-widest uppercase text-ink-faint font-medium pb-2 border-b border-hairline">
            <div>Item</div><div>Qty</div><div>Priority</div><div>Match status</div>
          </div>

          {items.map((it: any) => (
            <div key={it.client_request_items_id} className="grid grid-cols-[1fr_60px_90px_140px] gap-3 items-center py-3 border-b border-hairline last:border-0">
              <div>
                <div className="text-sm font-medium">{it.item_category}</div>
                {it.item_notes && <div className="text-[11px] text-ink-faint">{it.item_notes}</div>}
              </div>
              <div className="text-sm text-ink-soft">{it.quantity}</div>
              <div>{it.priority && <span className={`pill ${pillForPriority(it.priority)}`}>{it.priority}</span>}</div>
              <div>
                {it.matched_qty === 0
                  ? <span className="pill pill-terra">Unmatched</span>
                  : it.matched_qty >= it.quantity
                  ? <span className="pill pill-sage">Reserved · {it.matched_qty}</span>
                  : <span className="pill pill-gold">{it.matched_qty} of {it.quantity}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Reserved inventory</h3>
            </div>
            {matches.length === 0 ? (
              <div className="text-xs text-ink-faint">No inventory reserved yet.</div>
            ) : (
              <div className="space-y-2.5">
                {matches.map((m: any) => (
                  <div key={m.inventory_reservation_id} className="border border-hairline rounded-md bg-cream p-2.5">
                    <div className="text-xs font-medium">{m.description ?? m.item_category}</div>
                    <div className="text-[11px] text-ink-faint flex justify-between mt-1">
                      <span>{m.item_condition} · {m.facility_name}</span>
                      <span className="font-display font-medium text-ink">{formatMoney(m.donation_value_in)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="text-xs text-terracotta hover:text-terracotta-deep disabled:opacity-50 self-start"
          >
            {deleteMut.isPending ? 'Deleting…' : 'Delete this request'}
          </button>
        </div>
      </div>

      <div className="mt-5">
        <AttachmentsWidget entityType="request" entityId={Number(id)} title="Request documents (intake notes, household needs assessment, photos)" />
      </div>
    </>
  );
}

function pillForPriority(p: string) {
  const s = p.toLowerCase();
  if (s === 'high') return 'pill-terra';
  if (s === 'medium') return 'pill-gold';
  return 'pill-muted';
}
