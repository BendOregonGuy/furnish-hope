/**
 * Service log on a vendor's detail page. Lists past + scheduled
 * service events, with a "+ Log a service" button and inline edit.
 *
 * Cost is an authorization/estimate, not a bill — the bookkeeper
 * still enters bills in QuickBooks. This is operational memory.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api.ts';
import { Loading } from '../ui.tsx';

interface ServiceRow {
  vendor_service_id: number;
  vendor_id: number;
  service_date: string;
  start_time: string | null;
  end_time: string | null;
  location_text: string | null;
  corp_facility_id: number | null;
  description: string;
  cost_estimate: string | null;
  vendor_service_status_id: number;
  status: string;
  notes: string | null;
  created_at: string;
  facility_name: string | null;
  logged_by: string | null;
}

interface StatusRow { id: number; label: string }

export function ServiceLogWidget({ vendorId }: { vendorId: number }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ServiceRow | 'new' | null>(null);

  const { data: services, isLoading } = useQuery<ServiceRow[]>({
    queryKey: ['vendor-services', vendorId],
    queryFn: () => apiGet('/api/vendor-services', { vendor_id: String(vendorId) }),
  });

  const { data: statuses } = useQuery<StatusRow[]>({
    queryKey: ['lookup', 'vendor_service_status'],
    queryFn: () => apiGet('/api/lookups/vendor_service_status'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/vendor-services/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-services', vendorId] }),
  });

  return (
    <div className="card">
      <div className="card-head">
        <h3 className="font-display font-medium text-[17px] m-0">Service log</h3>
        <button type="button" onClick={() => setEditing('new')} className="text-xs text-terracotta hover:text-terracotta-deep border border-hairline-strong px-2 py-1 rounded hover:border-terracotta">
          + Log a service
        </button>
      </div>

      {editing && statuses && (
        <ServiceEditor
          vendorId={vendorId}
          initial={editing === 'new' ? null : editing}
          statuses={statuses}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['vendor-services', vendorId] });
            qc.invalidateQueries({ queryKey: ['calendar'] });
            setEditing(null);
          }}
        />
      )}

      {isLoading && <Loading />}
      {services && services.length === 0 && !editing && (
        <div className="text-sm text-ink-faint italic py-3">No service entries yet. Click "+ Log a service" the next time this vendor does work.</div>
      )}

      {services && services.length > 0 && (
        <div className="space-y-2 mt-2">
          {services.map(s => (
            <ServiceRowDisplay
              key={s.vendor_service_id}
              row={s}
              onEdit={() => setEditing(s)}
              onDelete={() => {
                if (window.confirm('Delete this service log entry?')) deleteMut.mutate(s.vendor_service_id);
              }}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-ink-faint italic mt-3">
        Bills + payments live in QuickBooks. This log is operational — what was authorized, what was done, when.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Row                                                                */
/* ----------------------------------------------------------------- */

function ServiceRowDisplay({
  row, onEdit, onDelete,
}: {
  row: ServiceRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const where = row.facility_name || row.location_text;
  const statusEmoji =
    row.status === 'Scheduled' ? '📅' :
    row.status === 'Completed' ? '✓' :
    row.status === 'Cancelled' ? '✗' :
    row.status === 'Billed'    ? '💵' : '·';
  const statusClass =
    row.status === 'Scheduled' ? 'pill-gold' :
    row.status === 'Completed' ? 'pill-sage' :
    row.status === 'Cancelled' ? 'pill-muted' :
    row.status === 'Billed'    ? 'pill-slate' : 'pill-muted';
  return (
    <div className="border border-hairline rounded p-2.5 hover:bg-cream/30 group">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`pill ${statusClass}`}>{statusEmoji} {row.status}</span>
          <span className="text-sm font-medium">{formatDate(row.service_date)}</span>
          {row.start_time && <span className="text-[11px] text-ink-faint">{row.start_time.slice(0, 5)}</span>}
          {where && <span className="text-[11px] text-ink-soft">@ {where}</span>}
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={onEdit} className="text-[11px] text-terracotta hover:text-terracotta-deep">Edit</button>
          <button type="button" onClick={onDelete} className="text-[11px] text-ink-faint hover:text-terracotta">Delete</button>
        </div>
      </div>
      <div className="text-sm text-ink whitespace-pre-wrap">{row.description}</div>
      {(row.cost_estimate || row.logged_by) && (
        <div className="text-[11px] text-ink-faint mt-1 flex items-center gap-3">
          {row.cost_estimate && <span>Authorized: <strong className="text-ink-soft">${row.cost_estimate}</strong></span>}
          {row.logged_by && <span>Logged by {row.logged_by}</span>}
        </div>
      )}
      {row.notes && (
        <div className="text-[11px] text-ink-soft italic mt-1 whitespace-pre-wrap">{row.notes}</div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Editor                                                             */
/* ----------------------------------------------------------------- */

function ServiceEditor({
  vendorId, initial, statuses, onClose, onSaved,
}: {
  vendorId: number;
  initial: ServiceRow | null;
  statuses: StatusRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial;
  const today = new Date().toISOString().slice(0, 10);
  const defaultStatus = statuses.find(s => s.label === 'Completed')?.id
                     ?? statuses[0]?.id ?? 1;

  const [serviceDate, setServiceDate]   = useState(initial?.service_date?.slice(0, 10) ?? today);
  const [startTime, setStartTime]       = useState(initial?.start_time?.slice(0, 5) ?? '');
  const [endTime, setEndTime]           = useState(initial?.end_time?.slice(0, 5) ?? '');
  const [locationText, setLocationText] = useState(initial?.location_text ?? '');
  const [description, setDescription]   = useState(initial?.description ?? '');
  const [costEstimate, setCostEstimate] = useState(initial?.cost_estimate ?? '');
  const [statusId, setStatusId]         = useState<number>(initial?.vendor_service_status_id ?? defaultStatus);
  const [notes, setNotes]               = useState(initial?.notes ?? '');
  const [err, setErr]                   = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        vendor_id: vendorId,
        service_date: serviceDate,
        start_time: startTime || null,
        end_time: endTime || null,
        location_text: locationText.trim() || null,
        description: description.trim(),
        cost_estimate: costEstimate || null,
        vendor_service_status_id: statusId,
        notes: notes.trim() || null,
      };
      return isNew
        ? apiPost('/api/vendor-services', payload)
        : apiPut(`/api/vendor-services/${initial!.vendor_service_id}`, payload);
    },
    onSuccess: () => onSaved(),
    onError: (e: any) => setErr(e.message ?? 'Save failed'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setErr(null);
    if (!description.trim()) { setErr('Description is required.'); return; }
    saveMut.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="border border-hairline-strong rounded p-3 bg-cream/30 mb-3 space-y-2.5">
      <div className="flex items-baseline justify-between mb-1">
        <h4 className="text-sm font-medium">{isNew ? 'New service entry' : 'Edit service entry'}</h4>
        <button type="button" onClick={onClose} className="text-xs text-ink-faint hover:text-terracotta">Cancel</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="field-label">Date *</label>
          <input type="date" className="field-input" value={serviceDate} onChange={e => setServiceDate(e.target.value)} required />
        </div>
        <div>
          <label className="field-label">Start time</label>
          <input type="time" className="field-input" value={startTime} onChange={e => setStartTime(e.target.value)} />
        </div>
        <div>
          <label className="field-label">End time</label>
          <input type="time" className="field-input" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="field-label">Status *</label>
          <select className="field-input" value={statusId} onChange={e => setStatusId(Number(e.target.value))}>
            {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Location</label>
          <input type="text" className="field-input" value={locationText} onChange={e => setLocationText(e.target.value)} placeholder="e.g. Warehouse, Unit 4B, Truck #2" />
        </div>
      </div>

      <div>
        <label className="field-label">What happened? *</label>
        <textarea rows={3} className="field-input font-sans" value={description} onChange={e => setDescription(e.target.value)} placeholder="Diagnosed faulty capacitor, replaced unit, flushed line. Suggested annual maintenance contract." required />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="field-label">Cost authorized ($)</label>
          <input type="number" step="0.01" className="field-input" value={costEstimate ?? ''} onChange={e => setCostEstimate(e.target.value)} placeholder="180.00" />
          <div className="text-[10px] text-ink-faint mt-1">Estimate / authorization — not the bill. Bills live in QuickBooks.</div>
        </div>
        <div>
          <label className="field-label">Notes</label>
          <input type="text" className="field-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional follow-up notes" />
        </div>
      </div>

      {err && <div className="text-xs text-terracotta-deep">{err}</div>}

      <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
        <button type="button" onClick={onClose} className="btn-ghost text-xs">Cancel</button>
        <button type="submit" disabled={saveMut.isPending} className="btn-primary text-xs disabled:opacity-60">
          {saveMut.isPending ? 'Saving…' : (isNew ? 'Add entry' : 'Save changes')}
        </button>
      </div>
    </form>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso); if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
