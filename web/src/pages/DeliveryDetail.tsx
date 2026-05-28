import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { apiDelete, apiGet, apiPost, formatMoney, formatLongDate } from '../lib/api.ts';
import { Avatar, Loading, ErrorBox, StatusPill } from '../components/ui.tsx';
import { DetailNavBar } from '../components/forms/FormNavBar.tsx';

type Detail = {
  delivery: any;
  crew: Array<any>;
  items: Array<any>;
  receipt: any | null;
  prevId: number | null;
  nextId: number | null;
};

export function DeliveryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<Detail>({
    queryKey: ['delivery', id],
    queryFn: () => apiGet(`/api/deliveries/${id}`),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/deliveries/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      navigate('/deliveries');
    },
    onError: (err: any) => window.alert(err.message ?? 'Delete failed'),
  });

  function handleDelete() {
    if (window.confirm('Permanently delete this delivery, including its crew, items, vehicle, and receipt? This cannot be undone.')) deleteMut.mutate();
  }

  const [showSignoff, setShowSignoff] = useState(false);
  const [allReceived, setAllReceived] = useState(true);
  const [conditionOk, setConditionOk] = useState(true);
  const [photoRelease, setPhotoRelease] = useState(false);
  const [notes, setNotes] = useState('');

  const signoff = useMutation({
    mutationFn: () => apiPost(`/api/deliveries/${id}/receipt`, {
      all_items_received: allReceived,
      condition_acceptable: conditionOk,
      photo_release_granted: photoRelease,
      recipient_notes: notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery', id] });
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setShowSignoff(false);
    },
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const { delivery: d, crew, items, receipt } = data;
  const totalValue = items.reduce((sum, i) => sum + Number(i.donation_value_in ?? 0), 0);
  const isDelivered = d.delivery_status === 'Delivered' || !!receipt;

  return (
    <>
      <DetailNavBar
        listLabel="deliveries" singularLabel="delivery" basePath="/deliveries"
        prevId={data.prevId} nextId={data.nextId}
        actions={
          <>
            <Link to="/deliveries/new" className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta">+ New delivery</Link>
            <Link to={`/deliveries/${id}/edit`} className="btn-primary text-xs py-1.5">
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
        <Avatar name={d.client_name} size="lg" />
        <div className="flex-1">
          <div className="flex items-baseline gap-3.5 mb-1">
            <div className="font-display text-2xl font-medium">{d.client_name}</div>
            <StatusPill status={d.delivery_status} />
            <span className="text-xs text-ink-faint">Delivery #{d.delivery_id}</span>
          </div>
          <div className="flex gap-4 text-sm text-ink-soft flex-wrap">
            {d.address && <span>{d.address}{d.address2 ? `, ${d.address2}` : ''}, {d.city} {d.postalcode}</span>}
            {d.client_phone && <><span>·</span><span>{d.client_phone}</span></>}
            {d.gate_code && <><span>·</span><span>Gate: <span className="text-ink font-medium font-mono">{d.gate_code}</span></span></>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-faint tracking-widest uppercase font-medium">Scheduled</div>
          <div className="font-display text-xl font-medium">{formatLongDate(d.delivery_date)}</div>
          {d.time_arrival_earliest && (
            <div className="text-xs text-ink-soft">{formatTime(d.time_arrival_earliest)}–{formatTime(d.time_arrival_latest)}</div>
          )}
        </div>
      </div>

      {!isDelivered && (
        <div className="mb-6 flex justify-end">
          <button className="btn-primary" onClick={() => setShowSignoff(true)}>
            Record recipient sign-off
          </button>
        </div>
      )}

      {receipt && (
        <div className="card mb-6 bg-sage-soft/40 border-sage/40">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-sage text-paper flex items-center justify-center font-medium">✓</div>
            <div>
              <div className="font-display font-medium">Delivery complete</div>
              <div className="text-xs text-ink-soft">Signed {formatLongDate(receipt.signed_at)}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
            <Confirmation ok={receipt.all_items_received} label="All items received" />
            <Confirmation ok={receipt.condition_acceptable} label="Condition acceptable" />
            <Confirmation ok={receipt.photo_release_granted} label="Photo release granted" />
          </div>
          {receipt.recipient_notes && (
            <div className="mt-3 pt-3 border-t border-sage/30 text-sm text-ink-soft italic">
              "{receipt.recipient_notes}"
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-[1fr_320px] gap-5">
        <div className="card">
          <div className="card-head">
            <h3 className="font-display font-medium text-[17px] m-0">Items loaded for delivery</h3>
            <div className="text-xs text-ink-faint">{items.length} items · {formatMoney(totalValue)} total</div>
          </div>
          {items.length === 0 ? (
            <div className="text-center text-ink-faint py-6 text-sm">No items loaded yet.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {items.map((it: any) => (
                  <tr key={it.delivery_items_id} className="border-t border-hairline first:border-0">
                    <td className="py-3 pr-3">
                      <div className="font-medium">{it.description ?? it.item_category}</div>
                      <div className="text-[11px] text-ink-faint">{it.item_category} · {it.item_condition ?? '—'}</div>
                    </td>
                    <td className="py-3 text-right text-xs text-ink-soft">{formatMoney(it.donation_value_in)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Delivery crew</h3>
            </div>
            {crew.length === 0 ? (
              <div className="text-xs text-ink-faint">No crew assigned yet.</div>
            ) : (
              <div className="space-y-2.5">
                {crew.map((m: any) => (
                  <div key={m.delivery_staff_id} className="flex items-center gap-2.5">
                    <Avatar name={m.name} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-[11px] text-ink-faint">
                        {m.is_team_lead ? 'Team lead' : 'Helper'}{m.is_volunteer ? ' · Volunteer' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head" style={{marginBottom:'10px', paddingBottom:'8px'}}>
              <h3 className="font-display font-medium text-sm m-0">Vehicle</h3>
            </div>
            {d.vehicle_license ? (
              <>
                <Detail label="License" value={d.vehicle_license} mono />
                <Detail label="Type" value={d.vehicle_type ?? '—'} />
                {d.rental_agency && <Detail label="Rental" value={d.rental_agency} />}
                <Detail label="Mileage out" value={d.mileage_start?.toLocaleString() ?? '—'} />
                <Detail label="Mileage in" value={d.mileage_end?.toLocaleString() ?? '—'} />
              </>
            ) : (
              <div className="text-xs text-ink-faint">No vehicle assigned.</div>
            )}
          </div>

          <button onClick={handleDelete} disabled={deleteMut.isPending}
            className="text-xs text-terracotta hover:text-terracotta-deep disabled:opacity-50 self-start">
            {deleteMut.isPending ? 'Deleting…' : 'Delete this delivery'}
          </button>
        </div>
      </div>

      {/* Sign-off modal */}
      {showSignoff && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-6 z-50" onClick={() => setShowSignoff(false)}>
          <div className="bg-paper rounded-[10px] max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-medium text-xl mb-1">Recipient sign-off</h3>
            <p className="text-sm text-ink-soft mb-5">
              Confirm with {d.client_name} that everything arrived as expected before closing out the delivery.
            </p>

            <div className="space-y-3 mb-5">
              <Checkbox checked={allReceived} onChange={setAllReceived}
                label="All items were received" />
              <Checkbox checked={conditionOk} onChange={setConditionOk}
                label="Condition is acceptable to recipient" />
              <Checkbox checked={photoRelease} onChange={setPhotoRelease}
                label="Photo release granted (optional)" />
            </div>

            <label className="field-label">Recipient notes (optional)</label>
            <textarea
              className="field-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the recipient wants noted…"
            />

            {signoff.error && (
              <div className="mt-3 text-sm text-terracotta-deep bg-terracotta-soft p-2 rounded-md">
                {(signoff.error as Error).message}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-ghost" onClick={() => setShowSignoff(false)} disabled={signoff.isPending}>Cancel</button>
              <button className="btn-primary" onClick={() => signoff.mutate()} disabled={signoff.isPending}>
                {signoff.isPending ? 'Saving…' : 'Complete delivery'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2 py-1 text-xs">
      <div className="text-ink-faint uppercase tracking-wider text-[10px] font-medium">{label}</div>
      <div className={'text-ink ' + (mono ? 'font-mono' : '')}>{value}</div>
    </div>
  );
}

function Confirmation({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={'w-4 h-4 rounded flex items-center justify-center text-[10px] text-paper ' + (ok ? 'bg-sage' : 'bg-hairline-strong')}>
        {ok ? '✓' : ''}
      </span>
      <span className={ok ? 'text-ink' : 'text-ink-faint line-through'}>{label}</span>
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-terracotta cursor-pointer"
      />
      <span className="text-sm">{label}</span>
    </label>
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
