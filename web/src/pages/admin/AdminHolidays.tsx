/**
 * Admin: holidays. Shift-template generation can opt to skip these
 * dates. Seeded with US federal holidays for 2 years out; admin can
 * add org-specific dates (retreats, closures) here.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../../components/ui.tsx';

interface Holiday {
  holiday_id: number;
  holiday_date: string;
  holiday_name: string;
  is_active: boolean;
  notes: string | null;
}

export function AdminHolidays() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);

  const { data, isLoading, error } = useQuery<Holiday[]>({
    queryKey: ['holidays'],
    queryFn: () => apiGet('/api/holidays'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/holidays/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
    onError: (e: any) => window.alert(e.message ?? 'Delete failed'),
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Holidays"
        subtitle="Dates that shift-template generation can skip. Federal holidays come pre-seeded; add org-specific closures (retreats, conferences, snow days) here."
        actions={<button onClick={() => setAdding(true)} className="btn-primary">+ New holiday</button>}
      />

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}

      {data && (
        <div className="card">
          {data.length === 0 ? (
            <div className="text-center text-sm text-ink-faint italic py-8">No holidays yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-cream">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-widest text-ink-faint font-medium">Date</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-widest text-ink-faint font-medium">Name</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-widest text-ink-faint font-medium">Status</th>
                  <th className="text-right px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {data.map(h => {
                  const past = h.holiday_date < today;
                  return (
                    <tr key={h.holiday_id} className={`border-t border-hairline ${past ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{h.holiday_date}</td>
                      <td className="px-4 py-2.5">
                        {h.holiday_name}
                        {h.notes && <div className="text-[11px] text-ink-faint">{h.notes}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        {h.is_active
                          ? <span className="pill pill-sage">Active</span>
                          : <span className="pill pill-muted">Ignored</span>}
                        {past && <span className="ml-2 text-[10px] text-ink-faint">past</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => setEditing(h)} className="text-xs text-ink-soft hover:text-terracotta mr-3">Edit</button>
                        <button onClick={() => { if (window.confirm(`Delete ${h.holiday_name}?`)) deleteMut.mutate(h.holiday_id); }} className="text-xs text-terracotta hover:text-terracotta-deep">Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {(adding || editing) && (
        <HolidayForm
          existing={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); qc.invalidateQueries({ queryKey: ['holidays'] }); }}
        />
      )}
    </>
  );
}

function HolidayForm({ existing, onClose, onSaved }: {
  existing: Holiday | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState({
    holiday_date: existing?.holiday_date ?? '',
    holiday_name: existing?.holiday_name ?? '',
    notes:        existing?.notes ?? '',
    is_active:    existing?.is_active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { ...v, notes: v.notes.trim() || null };
      return existing
        ? apiPut(`/api/holidays/${existing.holiday_id}`, body)
        : apiPost('/api/holidays', body);
    },
    onSuccess: () => onSaved(),
    onError: (err: any) => setError(err.message ?? 'Save failed'),
  });

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-start justify-center pt-16" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-paper rounded-lg shadow-2xl border border-hairline w-[440px] max-w-[calc(100vw-32px)]">
        <div className="px-5 py-4 border-b border-hairline flex items-baseline justify-between">
          <h2 className="font-display text-xl font-medium m-0">{existing ? 'Edit holiday' : 'New holiday'}</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-terracotta text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="field-label">Date *</label>
            <input type="date" className="field-input" value={v.holiday_date} onChange={e => setV({ ...v, holiday_date: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Name *</label>
            <input type="text" className="field-input" value={v.holiday_name} onChange={e => setV({ ...v, holiday_name: e.target.value })} maxLength={120} />
          </div>
          <div>
            <label className="field-label">Notes</label>
            <input type="text" className="field-input" value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} maxLength={200} />
          </div>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={v.is_active} onChange={e => setV({ ...v, is_active: e.target.checked })} className="w-4 h-4 accent-terracotta" />
            Active — shift generation will skip this date when "Skip holidays" is on
          </label>

          {error && <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-hairline flex justify-end gap-2 bg-cream/40 rounded-b-lg">
          <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
          <button
            onClick={() => {
              if (!v.holiday_date) { setError('Date is required.'); return; }
              if (!v.holiday_name.trim()) { setError('Name is required.'); return; }
              saveMut.mutate();
            }}
            disabled={saveMut.isPending}
            className="btn-primary text-xs disabled:opacity-60"
          >
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
