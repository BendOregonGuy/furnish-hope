/**
 * Create + edit form for a fundraising campaign.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api.ts';
import type { ColumnMeta } from '../lib/admin.ts';
import { validateForm, type FormErrors } from '../lib/adminValidate.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { Field } from '../components/admin/Field.tsx';
import { FormNavBar } from '../components/forms/FormNavBar.tsx';
import { Section, FieldGrid, Cell } from '../components/forms/FormSection.tsx';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.ts';

const FIELDS: ColumnMeta[] = [
  { name: 'campaign_name',      label: 'Campaign name', type: 'text', required: true, isPk: false, isFk: false, maxLength: 150 },
  { name: 'campaign_type_id',   label: 'Type',          type: 'fk',   required: true, isPk: false, isFk: true,  fkTable: 'lkp_campaign_type' },
  { name: 'campaign_status_id', label: 'Status',        type: 'fk',   required: true, isPk: false, isFk: true,  fkTable: 'lkp_campaign_status' },
  { name: 'fund_id',            label: 'Fund',          type: 'fk',   required: false, isPk: false, isFk: true, fkTable: 'lkp_fund',
    helpText: 'Which fund this campaign feeds. Leave blank for unrestricted.' },
  { name: 'goal_amount',        label: 'Goal ($)',      type: 'money', required: false, isPk: false, isFk: false, scale: 2 },
  { name: 'start_date',         label: 'Start date',    type: 'date', required: false, isPk: false, isFk: false },
  { name: 'end_date',           label: 'End date',      type: 'date', required: false, isPk: false, isFk: false },
  { name: 'manager_facility_staff_id', label: 'Manager', type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'tbl_facility_staff' },
  { name: 'public_url',         label: 'Public URL',    type: 'text', required: false, isPk: false, isFk: false, maxLength: 255,
    helpText: 'Optional online giving page or info site.' },
  { name: 'notes',              label: 'Notes',         type: 'textarea', required: false, isPk: false, isFk: false },
];

export function CampaignForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading, error: loadError } = useQuery<any>({
    queryKey: ['campaign', id],
    queryFn: () => apiGet(`/api/campaigns/${id}`),
    enabled: !isNew,
  });

  const [values, setValues] = useState<Record<string, any>>(() => blankForm());
  const [initial, setInitial] = useState<Record<string, any>>(() => blankForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<number | null>(null);

  useEffect(() => {
    setSubmitAttempted(false); setErrors({}); setTopError(null);
    if (isNew) {
      const blank = blankForm();
      setValues(blank); setInitial(blank);
      return;
    }
    if (!existing) return;
    const c = existing.campaign;
    const v: Record<string, any> = {
      campaign_name: c.campaign_name ?? '',
      campaign_type_id: c.campaign_type_id,
      campaign_status_id: c.campaign_status_id,
      fund_id: c.fund_id,
      goal_amount: c.goal_amount,
      start_date: dateOnly(c.start_date),
      end_date: dateOnly(c.end_date),
      manager_facility_staff_id: c.manager_facility_staff_id,
      public_url: c.public_url ?? '',
      notes: c.notes ?? '',
    };
    setValues(v); setInitial(v);
  }, [existing, isNew]);

  const { isDirty, safeNavigate } = useUnsavedChanges({ values, initialValues: initial });

  const createMut = useMutation({
    mutationFn: (body: any) => apiPost<{ campaign_id: number }>('/api/campaigns', body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setInitial(values);
      navigate(`/campaigns/${data.campaign_id}`);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut<{ campaign_id: number }>(`/api/campaigns/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      setInitial(values);
      setTopError(null); setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 2200);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setInitial(values);
      navigate('/campaigns');
    },
    onError: (err: any) => setTopError(err.message ?? 'Delete failed'),
  });

  if (isLoading) return <Loading />;
  if (loadError) return <ErrorBox error={loadError} />;

  function setField(name: string, v: any) {
    setValues(prev => ({ ...prev, [name]: v }));
    if (submitAttempted) {
      const col = FIELDS.find(c => c.name === name);
      if (col) {
        const next = { ...errors };
        const fieldErr = validateForm([col], { [name]: v })[name];
        if (fieldErr) next[name] = fieldErr; else delete next[name];
        setErrors(next);
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    const errs = validateForm(FIELDS, values);
    if (values.start_date && values.end_date && new Date(values.end_date) < new Date(values.start_date)) {
      errs.end_date = 'End date cannot be before start date.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setTopError('Please fix the highlighted fields.');
      const first = Object.keys(errs)[0];
      const el = document.getElementById(`field-${first}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setTopError(null);

    const body = {
      campaign_name: values.campaign_name,
      campaign_type_id: Number(values.campaign_type_id),
      campaign_status_id: Number(values.campaign_status_id),
      fund_id: values.fund_id ? Number(values.fund_id) : null,
      goal_amount: values.goal_amount === '' || values.goal_amount == null ? null : Number(values.goal_amount),
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      manager_facility_staff_id: values.manager_facility_staff_id ? Number(values.manager_facility_staff_id) : null,
      public_url: values.public_url || null,
      notes: values.notes || null,
    };
    if (isNew) createMut.mutate(body);
    else updateMut.mutate(body);
  }

  function handleDelete() {
    if (!window.confirm('Permanently delete this campaign? Cancel it instead if linked records exist.')) return;
    deleteMut.mutate();
  }

  const saving = createMut.isPending || updateMut.isPending;
  const title = !isNew && existing ? existing.campaign.campaign_name : 'New campaign';

  return (
    <>
      <PageHeader
        title={isNew ? 'New' : title}
        emphasis={isNew ? 'campaign' : undefined}
        subtitle={isNew ? 'Create a new fundraising drive.' : `Editing campaign #${id}.`}
      />

      <FormNavBar
        listLabel="campaigns" singularLabel="campaign" basePath="/campaigns"
        isNew={isNew} prevId={null} nextId={null}
        isDirty={isDirty} savedFlash={savedFlash} onNav={safeNavigate}
      />

      {topError && <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
        <Section title="Campaign" hint="Name it, set the goal, pick the type and status.">
          <FieldGrid>
            {FIELDS.map(col => (
              <Cell key={col.name} col={col}>
                <Field
                  col={col} value={values[col.name]}
                  initialFkLabel={initialFkLabel(existing?.campaign, col.name)}
                  error={errors[col.name] ?? null}
                  onChange={v => setField(col.name, v)}
                />
              </Cell>
            ))}
          </FieldGrid>
        </Section>

        <div className="card flex items-center justify-between gap-3">
          <div>
            {!isNew && (
              <button type="button" onClick={handleDelete} disabled={deleteMut.isPending}
                className="text-sm text-terracotta hover:text-terracotta-deep disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting…' : 'Delete this campaign'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDirty && !saving && <span className="text-[11px] text-ink-faint italic">Unsaved changes</span>}
            <button type="button" onClick={() => safeNavigate(isNew ? '/campaigns' : `/campaigns/${id}`)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : (isNew ? 'Create campaign' : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function blankForm(): Record<string, any> {
  return {
    campaign_name: '', campaign_type_id: null, campaign_status_id: null,
    fund_id: null, goal_amount: '', start_date: '', end_date: '',
    manager_facility_staff_id: null, public_url: '', notes: '',
  };
}

function dateOnly(value: any): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function initialFkLabel(c: any, columnName: string): string | undefined {
  if (!c) return undefined;
  switch (columnName) {
    case 'campaign_type_id':   return c.campaign_type;
    case 'campaign_status_id': return c.campaign_status;
    case 'fund_id':            return c.fund_name;
    case 'manager_facility_staff_id': return c.manager_name;
    default: return undefined;
  }
}
