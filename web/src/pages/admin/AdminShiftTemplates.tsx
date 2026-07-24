/**
 * Admin: shift templates. CRUD over tbl_shift_template plus a
 * "Generate shifts" action that creates actual shift rows for a
 * date range based on every active template.
 *
 * Templates define a recurring pattern; generating turns the pattern
 * into concrete shift rows that staff can sign up for.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../../components/ui.tsx';
import { FkSelect } from '../../components/admin/FkSelect.tsx';

interface Template {
  shift_template_id: number;
  template_name: string;
  shift_type_id: number;
  shift_type: string;
  corp_facility_id: number | null;
  facility_name: string | null;
  shift_name: string | null;
  start_time: string | null;
  end_time: string | null;
  capacity_needed: number;
  notes: string | null;
  day_of_week_mask: number;
  skip_holidays: boolean;
  is_active: boolean;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function AdminShiftTemplates() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Template | 'new' | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  const { data, isLoading, error } = useQuery<Template[]>({
    queryKey: ['shift-templates'],
    queryFn: () => apiGet('/api/shift-templates'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/shift-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-templates'] }),
    onError: (e: any) => window.alert(e.message ?? 'Delete failed'),
  });

  return (
    <>
      <PageHeader
        helpSection="admin-shifts"
        title="Shift"
        emphasis="templates"
        subtitle='Recurring shift patterns. Define once, "Generate" to create the actual shifts for any date range. Skips federal holidays by default.'
        actions={
          <>
            <button onClick={() => setEditing('new')} className="btn-ghost">+ New template</button>
            <button onClick={() => setShowGenerate(true)} className="btn-primary" disabled={!data || data.filter(t => t.is_active).length === 0}>
              Generate shifts
            </button>
          </>
        }
      />

      {isLoading && <Loading />}
      {error && <ErrorBox error={error} />}

      {data && (
        <div className="card mb-5">
          {data.length === 0 ? (
            <div className="text-center text-sm text-ink-faint italic py-8">
              No templates yet. Click <strong>+ New template</strong> to define a recurring shift pattern.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-cream">
                <tr>
                  <Th>Template</Th>
                  <Th>Type</Th>
                  <Th>Days</Th>
                  <Th>Time window</Th>
                  <Th>Capacity</Th>
                  <Th>Status</Th>
                  <Th className="text-right">{' '}</Th>
                </tr>
              </thead>
              <tbody>
                {data.map(t => (
                  <tr key={t.shift_template_id} className={`border-t border-hairline ${!t.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{t.template_name}</div>
                      {t.facility_name && <div className="text-[11px] text-ink-faint">{t.facility_name}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{t.shift_type}</td>
                    <td className="px-4 py-2.5">
                      <DayBadges mask={t.day_of_week_mask} />
                      {t.skip_holidays && <div className="text-[10px] text-ink-faint mt-0.5">⛔ skips holidays</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {t.start_time && t.end_time ? `${formatTime(t.start_time)} – ${formatTime(t.end_time)}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{t.capacity_needed}</td>
                    <td className="px-4 py-2.5">
                      <span className={`pill ${t.is_active ? 'pill-sage' : 'pill-muted'}`}>
                        {t.is_active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => setEditing(t)} className="text-xs text-ink-soft hover:text-terracotta mr-3">Edit</button>
                      <button onClick={() => { if (window.confirm(`Delete "${t.template_name}"?`)) deleteMut.mutate(t.shift_template_id); }} className="text-xs text-terracotta hover:text-terracotta-deep">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editing && (
        <TemplateForm
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['shift-templates'] }); }}
        />
      )}

      {showGenerate && (
        <GenerateModal
          onClose={() => setShowGenerate(false)}
          onDone={() => { setShowGenerate(false); qc.invalidateQueries({ queryKey: ['shifts'] }); qc.invalidateQueries({ queryKey: ['calendar'] }); }}
        />
      )}
    </>
  );
}

/* ----------------------------------------------------------------- */
/*  Day-of-week badges                                                */
/* ----------------------------------------------------------------- */

function DayBadges({ mask }: { mask: number }) {
  return (
    <div className="inline-flex gap-0.5">
      {DAY_LABELS.map((d, i) => {
        const on = ((mask >> i) & 1) === 1;
        return (
          <span
            key={i}
            title={DAY_NAMES[i]}
            className={`inline-flex items-center justify-center w-5 h-5 rounded-sm text-[10px] font-medium ${
              on ? 'bg-terracotta text-paper' : 'bg-cream text-ink-faint'
            }`}
          >
            {d}
          </span>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Template form (create / edit)                                     */
/* ----------------------------------------------------------------- */

function TemplateForm({ existing, onClose, onSaved }: {
  existing: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState({
    template_name:   existing?.template_name ?? '',
    shift_name:      existing?.shift_name ?? '',
    shift_type_id:   existing?.shift_type_id ?? null as number | null,
    corp_facility_id: existing?.corp_facility_id ?? null as number | null,
    start_time:      existing?.start_time ?? '08:00',
    end_time:        existing?.end_time ?? '12:00',
    capacity_needed: existing?.capacity_needed ?? 2,
    notes:           existing?.notes ?? '',
    day_of_week_mask: existing?.day_of_week_mask ?? 0b0111110, // Mon-Fri default
    skip_holidays:   existing?.skip_holidays ?? true,
    is_active:       existing?.is_active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        ...v,
        template_name: v.template_name.trim(),
        shift_name: v.shift_name.trim() || null,
        notes: v.notes.trim() || null,
        start_time: v.start_time || null,
        end_time: v.end_time || null,
      };
      return existing
        ? apiPut(`/api/shift-templates/${existing.shift_template_id}`, body)
        : apiPost('/api/shift-templates', body);
    },
    onSuccess: () => onSaved(),
    onError: (err: any) => setError(err.message ?? 'Save failed'),
  });

  function toggleDay(i: number) {
    setV(prev => ({ ...prev, day_of_week_mask: prev.day_of_week_mask ^ (1 << i) }));
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-start justify-center pt-16 pb-10 overflow-y-auto" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-paper rounded-lg shadow-2xl border border-hairline w-[640px] max-w-[calc(100vw-32px)]">
        <div className="px-5 py-4 border-b border-hairline flex items-baseline justify-between">
          <h2 className="font-display text-xl font-medium m-0">
            {existing ? `Edit ${existing.template_name}` : 'New shift template'}
          </h2>
          <button onClick={onClose} className="text-ink-faint hover:text-terracotta text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 max-h-[calc(100vh-220px)] overflow-y-auto space-y-3">
          <div>
            <RequiredLabel>Template name</RequiredLabel>
            <input type="text" className="field-input" value={v.template_name} onChange={e => setV({ ...v, template_name: e.target.value })} placeholder="e.g. Weekday AM Warehouse" maxLength={120} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <RequiredLabel>Shift type</RequiredLabel>
              <FkSelect fkTable="lkp_shift_type" value={v.shift_type_id} onChange={id => setV({ ...v, shift_type_id: id })} required />
            </div>
            <div>
              <label className="field-label">Facility</label>
              <FkSelect fkTable="tbl_corp_facility" value={v.corp_facility_id} onChange={id => setV({ ...v, corp_facility_id: id })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="field-label">Start time</label>
              <input type="time" className="field-input" value={v.start_time} onChange={e => setV({ ...v, start_time: e.target.value })} />
            </div>
            <div>
              <label className="field-label">End time</label>
              <input type="time" className="field-input" value={v.end_time} onChange={e => setV({ ...v, end_time: e.target.value })} />
            </div>
            <div>
              <RequiredLabel>Capacity</RequiredLabel>
              <input type="number" min={1} className="field-input" value={v.capacity_needed} onChange={e => setV({ ...v, capacity_needed: Number(e.target.value) || 1 })} />
            </div>
          </div>

          <div>
            <RequiredLabel>Days of week this template applies to</RequiredLabel>
            <div className="flex gap-1 mt-1">
              {DAY_LABELS.map((d, i) => {
                const on = ((v.day_of_week_mask >> i) & 1) === 1;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    title={DAY_NAMES[i]}
                    className={`flex-1 py-2 rounded text-sm font-medium border transition ${
                      on
                        ? 'bg-terracotta text-paper border-terracotta'
                        : 'bg-paper text-ink-soft border-hairline-strong hover:border-terracotta'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2 text-[11px]">
              <button type="button" onClick={() => setV({ ...v, day_of_week_mask: 0b0111110 })} className="text-ink-faint hover:text-terracotta">Mon–Fri</button>
              <button type="button" onClick={() => setV({ ...v, day_of_week_mask: 0b1000001 })} className="text-ink-faint hover:text-terracotta">Sat + Sun</button>
              <button type="button" onClick={() => setV({ ...v, day_of_week_mask: 0b1111111 })} className="text-ink-faint hover:text-terracotta">Every day</button>
            </div>
            <div className="text-[11px] text-ink-faint mt-1.5 leading-snug">
              Pick which days of the week this template should create shifts on.
              When you click <strong>Generate shifts</strong>, the system creates one
              shift per matching weekday in your chosen date range. At least one day
              must be selected, otherwise the template would never generate anything.
            </div>
          </div>

          <div>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={v.skip_holidays} onChange={e => setV({ ...v, skip_holidays: e.target.checked })} className="w-4 h-4 accent-terracotta" />
              Skip federal holidays
            </label>
          </div>

          <div>
            <label className="field-label">Shift name (optional)</label>
            <input type="text" className="field-input" value={v.shift_name} onChange={e => setV({ ...v, shift_name: e.target.value })} placeholder="Defaults to the template name on generated shifts" maxLength={120} />
          </div>

          <div>
            <label className="field-label">Notes (appear on every generated shift)</label>
            <textarea rows={2} className="field-input" value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} />
          </div>

          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={v.is_active} onChange={e => setV({ ...v, is_active: e.target.checked })} className="w-4 h-4 accent-terracotta" />
            Active — uncheck to pause generation without deleting
          </label>

          {error && <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-hairline flex justify-end gap-2 bg-cream/40 rounded-b-lg">
          <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="btn-primary text-xs disabled:opacity-60">
            {saveMut.isPending ? 'Saving…' : (existing ? 'Save changes' : 'Create template')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Generate modal                                                    */
/* ----------------------------------------------------------------- */

function GenerateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const fourWeeksOut = (() => {
    const d = new Date(); d.setDate(d.getDate() + 28);
    return d.toISOString().slice(0, 10);
  })();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(fourWeeksOut);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const genMut = useMutation({
    mutationFn: () => apiPost<{ summary: any }>('/api/shift-templates/generate', { from_date: from, to_date: to }),
    onSuccess: r => setSummary(r.summary),
    onError: (err: any) => setError(err.message ?? 'Generate failed'),
  });

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-start justify-center pt-16 pb-10" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-paper rounded-lg shadow-2xl border border-hairline w-[480px] max-w-[calc(100vw-32px)]">
        <div className="px-5 py-4 border-b border-hairline flex items-baseline justify-between">
          <div>
            <h2 className="font-display text-xl font-medium m-0">Generate shifts</h2>
            <p className="text-[11px] text-ink-faint mt-0.5">Create shift rows from every active template across this date range.</p>
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-terracotta text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">From</label>
              <input type="date" className="field-input" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="field-label">To (inclusive)</label>
              <input type="date" className="field-input" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>

          {summary && (
            <div className="p-3 bg-sage-soft text-[#3F4A33] rounded-md text-sm">
              ✓ Generated <strong>{summary.shifts_created}</strong> new shift{summary.shifts_created === 1 ? '' : 's'}
              {' '}from <strong>{summary.templates_used}</strong> template{summary.templates_used === 1 ? '' : 's'}.
              {summary.skipped_holiday > 0 && <div className="text-xs mt-1">Skipped {summary.skipped_holiday} holiday occurrence{summary.skipped_holiday === 1 ? '' : 's'}.</div>}
              {summary.skipped_already_generated > 0 && <div className="text-xs mt-1">{summary.skipped_already_generated} already existed for these dates.</div>}
            </div>
          )}
          {error && <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-hairline flex justify-end gap-2 bg-cream/40 rounded-b-lg">
          <button onClick={() => { onDone(); }} className="btn-ghost text-xs">{summary ? 'Done' : 'Cancel'}</button>
          {!summary && (
            <button onClick={() => genMut.mutate()} disabled={genMut.isPending || !from || !to} className="btn-primary text-xs disabled:opacity-60">
              {genMut.isPending ? 'Generating…' : 'Generate'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-4 py-2.5 text-[10px] uppercase tracking-widest text-ink-faint font-medium ${className ?? ''}`}>{children}</th>;
}

/** Field label with a clearly-styled required indicator. Matches the
 *  pattern used by the generic <Field> component (terracotta asterisk,
 *  inline-flex layout) so required fields look the same everywhere. */
function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="field-label flex items-center gap-1">
      {children}
      <span className="text-terracotta" title="Required">*</span>
    </label>
  );
}

function formatTime(t: string): string {
  const [hh, mm] = t.split(':');
  let h = Number(hh);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${ampm}`;
}
