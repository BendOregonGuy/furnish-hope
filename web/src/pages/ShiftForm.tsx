/**
 * Create + edit form for a volunteer shift.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api.ts';
import type { ColumnMeta } from '../lib/admin.ts';
import { validateForm, type FormErrors } from '../lib/adminValidate.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { Field } from '../components/admin/Field.tsx';
import { FkCreateField } from '../components/admin/FkSelectWithCreate.tsx';
import { CorpFacilityQuickCreateModal } from '../components/quickCreate/CorpFacilityQuickCreateModal.tsx';
import { FormNavBar } from '../components/forms/FormNavBar.tsx';
import { Section, FieldGrid, Cell } from '../components/forms/FormSection.tsx';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.ts';

const FIELDS: ColumnMeta[] = [
  { name: 'shift_type_id',   label: 'Shift type',  type: 'fk',   required: true,  isPk: false, isFk: true, fkTable: 'lkp_shift_type' },
  { name: 'shift_status_id', label: 'Status',      type: 'fk',   required: true,  isPk: false, isFk: true, fkTable: 'lkp_shift_status' },
  { name: 'shift_name',      label: 'Shift name',  type: 'text', required: false, isPk: false, isFk: false, maxLength: 120, helpText: 'Optional friendly name (e.g. "Saturday warehouse stocking").' },
  { name: 'corp_facility_id',label: 'Facility',    type: 'fk',   required: false, isPk: false, isFk: true, fkTable: 'tbl_corp_facility' },
  { name: 'shift_date',      label: 'Date',        type: 'date', required: true,  isPk: false, isFk: false },
  { name: 'start_time',      label: 'Start time',  type: 'time', required: false, isPk: false, isFk: false },
  { name: 'end_time',        label: 'End time',    type: 'time', required: false, isPk: false, isFk: false },
  { name: 'capacity_needed', label: 'Capacity needed', type: 'number', required: true, isPk: false, isFk: false, helpText: 'How many people are needed for this shift.' },
  { name: 'notes',           label: 'Notes',       type: 'textarea', required: false, isPk: false, isFk: false },
];

function blankState(): Record<string, any> {
  return {
    shift_type_id: null, shift_status_id: null, shift_name: '',
    corp_facility_id: null,
    shift_date: '', start_time: '', end_time: '',
    capacity_needed: 1, notes: '',
  };
}

interface ShiftDetailResponse {
  shift: any;
  signups: any[];
  prevId: number | null;
  nextId: number | null;
}

export function ShiftForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading: loadingExisting, error: loadError } = useQuery<ShiftDetailResponse>({
    queryKey: ['shift', id],
    queryFn: () => apiGet(`/api/shifts/${id}`),
    enabled: !isNew,
  });

  const [values, setValues] = useState<Record<string, any>>(() => blankState());
  const [initial, setInitial] = useState<Record<string, any>>(() => blankState());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<number | null>(null);

  useEffect(() => {
    if (existing?.shift) {
      const s = existing.shift;
      const init = {
        shift_type_id:   s.shift_type_id,
        shift_status_id: s.shift_status_id,
        shift_name:      s.shift_name ?? '',
        corp_facility_id: s.corp_facility_id,
        shift_date:      String(s.shift_date).slice(0, 10),
        start_time:      s.start_time ?? '',
        end_time:        s.end_time ?? '',
        capacity_needed: s.capacity_needed ?? 1,
        notes:           s.notes ?? '',
      };
      setValues(init);
      setInitial(init);
    }
  }, [existing]);

  const { isDirty, safeNavigate } = useUnsavedChanges({ values, initialValues: initial });

  function setField(name: string, v: any) {
    setValues(prev => ({ ...prev, [name]: v }));
    if (submitAttempted) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  const createMut = useMutation({
    mutationFn: (body: any) => apiPost<{ shift_id: number }>('/api/shifts', body),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      navigate(`/shifts/${r.shift_id}`);
    },
    onError: (e: any) => setTopError(e.message ?? 'Save failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut(`/api/shifts/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['shift', id] });
      setInitial(values);
      setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 1800);
    },
    onError: (e: any) => setTopError(e.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/shifts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); navigate('/shifts'); },
    onError: (e: any) => window.alert(e.message ?? 'Delete failed'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setTopError(null);
    const errs = validateForm(FIELDS, values);
    if (Object.keys(errs).length) {
      setErrors(errs);
      setTopError('Some required fields are missing.');
      return;
    }
    const body = {
      shift_type_id: Number(values.shift_type_id),
      shift_status_id: Number(values.shift_status_id),
      shift_name: values.shift_name || null,
      corp_facility_id: values.corp_facility_id ?? null,
      shift_date: values.shift_date,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      capacity_needed: Number(values.capacity_needed),
      notes: values.notes || null,
    };
    if (isNew) createMut.mutate(body); else updateMut.mutate(body);
  }

  function handleDelete() {
    if (window.confirm('Delete this shift? All signups will be removed.')) deleteMut.mutate();
  }

  if (!isNew && loadingExisting) return <Loading />;
  if (loadError) return <ErrorBox error={loadError} />;

  const saving = createMut.isPending || updateMut.isPending;
  const title = !isNew && existing?.shift ? (existing.shift.shift_name ?? existing.shift.shift_type) : 'New shift';

  function renderField(col: ColumnMeta) {
    if (col.name === 'corp_facility_id') {
      return (
        <Cell key={col.name} col={col}>
          <FkCreateField
            label={col.label} required={col.required} helpText={col.helpText}
            error={errors[col.name] ?? null}
            fkTable="tbl_corp_facility"
            value={values.corp_facility_id ?? null}
            onChange={v => setField('corp_facility_id', v)}
            newButtonLabel="+ New facility"
            renderModal={ctx => <CorpFacilityQuickCreateModal {...ctx} />}
          />
        </Cell>
      );
    }
    return (
      <Cell key={col.name} col={col}>
        <Field col={col} value={values[col.name]} error={errors[col.name] ?? null} onChange={v => setField(col.name, v)} />
      </Cell>
    );
  }

  return (
    <>
      <PageHeader
        helpSection="shifts"
        title={isNew ? 'New' : title}
        emphasis={isNew ? 'shift' : undefined}
        subtitle={isNew ? 'Schedule a time block for volunteers to sign up.' : `Editing shift #${id}.`}
      />

      <FormNavBar
        listLabel="shifts" singularLabel="shift" basePath="/shifts"
        isNew={isNew} prevId={existing?.prevId ?? null} nextId={existing?.nextId ?? null}
        isDirty={isDirty} savedFlash={savedFlash} onNav={safeNavigate}
      />

      {topError && <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
        {isNew && <ApplyTemplateRow onApply={tpl => setValues(prev => ({
          ...prev,
          shift_type_id:    tpl.shift_type_id    ?? prev.shift_type_id,
          corp_facility_id: tpl.corp_facility_id ?? prev.corp_facility_id,
          shift_name:       prev.shift_name || tpl.shift_name || tpl.template_name || '',
          start_time:       tpl.start_time ?? prev.start_time,
          end_time:         tpl.end_time   ?? prev.end_time,
          capacity_needed:  tpl.capacity_needed ?? prev.capacity_needed,
          notes:            prev.notes || tpl.notes || '',
        }))} />}

        <Section title="Shift" hint="When, where, and how many people you need.">
          <FieldGrid>{FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <div className="card flex items-center justify-between gap-3">
          <div>
            {!isNew && (
              <button type="button" onClick={handleDelete} disabled={deleteMut.isPending}
                className="text-sm text-terracotta hover:text-terracotta-deep disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting…' : 'Delete shift'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => safeNavigate('/shifts')} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : (isNew ? 'Create shift' : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

/* ----------------------------------------------------------------- */
/*  Apply-template row — only shown on /shifts/new                    */
/* ----------------------------------------------------------------- */

interface TemplateOption {
  shift_template_id: number;
  template_name: string;
  shift_type_id: number;
  corp_facility_id: number | null;
  shift_name: string | null;
  start_time: string | null;
  end_time: string | null;
  capacity_needed: number;
  notes: string | null;
}

function ApplyTemplateRow({ onApply }: { onApply: (tpl: TemplateOption) => void }) {
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [picked, setPicked] = useState<number | ''>('');

  // Lazy load — only fetch if the user is on the new-shift page.
  useEffect(() => {
    apiGet<TemplateOption[]>('/api/shift-templates')
      .then(rs => setTemplates(rs.filter((t: any) => t.is_active)))
      .catch(() => setTemplates([]));
  }, []);

  if (!templates || templates.length === 0) return null;

  return (
    <div className="card bg-cream/40 border-dashed">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <label className="field-label">Apply template (optional)</label>
          <select
            value={picked}
            onChange={e => setPicked(e.target.value ? Number(e.target.value) : '')}
            className="field-input"
          >
            <option value="">— Pick a template to pre-fill —</option>
            {templates.map(t => (
              <option key={t.shift_template_id} value={t.shift_template_id}>
                {t.template_name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            const tpl = templates.find(t => t.shift_template_id === picked);
            if (tpl) onApply(tpl);
          }}
          disabled={!picked}
          className="btn-primary disabled:opacity-50"
        >
          Apply
        </button>
      </div>
      <div className="text-[11px] text-ink-faint mt-2">
        Pre-fills type, facility, time, capacity, and notes — you can still change anything before saving.
      </div>
    </div>
  );
}
