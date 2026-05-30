/**
 * Create + edit form for a pledge (commitment to give).
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
  { name: 'donor_id',                 label: 'Donor',                type: 'fk',    required: true, isPk: false, isFk: true, fkTable: 'tbl_donor' },
  { name: 'fund_id',                  label: 'Fund',                 type: 'fk',    required: false, isPk: false, isFk: true, fkTable: 'lkp_fund',
    helpText: 'Restrict to a specific fund, or leave blank for unrestricted.' },
  { name: 'total_pledged_amount',     label: 'Total pledged ($)',    type: 'money', required: true, isPk: false, isFk: false, scale: 2 },
  { name: 'pledge_date',              label: 'Pledge date',          type: 'date',  required: true, isPk: false, isFk: false },
  { name: 'expected_fulfillment_date', label: 'Expected fulfillment', type: 'date', required: false, isPk: false, isFk: false,
    helpText: 'When you expect the donor to complete payment. Used to flag overdue pledges.' },
  { name: 'pledge_status_id',         label: 'Status',               type: 'fk',    required: true, isPk: false, isFk: true, fkTable: 'lkp_pledge_status' },
  { name: 'solicitation_method_id',   label: 'Solicitation method',  type: 'fk',    required: false, isPk: false, isFk: true, fkTable: 'lkp_solicitation_method' },
  { name: 'notes',                    label: 'Notes',                type: 'textarea', required: false, isPk: false, isFk: false },
];

interface PledgeResponse { pledge: any; payments: any[]; }

export function PledgeForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading, error: loadError } = useQuery<PledgeResponse>({
    queryKey: ['pledge', id],
    queryFn: () => apiGet(`/api/pledges/${id}`),
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
      blank.pledge_date = todayIso();
      setValues(blank); setInitial(blank);
      return;
    }
    if (!existing) return;
    const p = existing.pledge;
    const v: Record<string, any> = {
      donor_id: p.donor_id,
      fund_id: p.fund_id,
      total_pledged_amount: p.total_pledged_amount,
      pledge_date: dateOnly(p.pledge_date),
      expected_fulfillment_date: dateOnly(p.expected_fulfillment_date),
      pledge_status_id: p.pledge_status_id,
      solicitation_method_id: p.solicitation_method_id,
      notes: p.notes ?? '',
    };
    setValues(v); setInitial(v);
  }, [existing, isNew]);

  const { isDirty, safeNavigate } = useUnsavedChanges({ values, initialValues: initial });

  const createMut = useMutation({
    mutationFn: (body: any) => apiPost<{ pledge_id: number }>('/api/pledges', body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pledges'] });
      setInitial(values);
      navigate(`/pledges/${data.pledge_id}`);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut<{ pledge_id: number }>(`/api/pledges/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pledges'] });
      queryClient.invalidateQueries({ queryKey: ['pledge', id] });
      setInitial(values);
      setTopError(null); setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 2200);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/pledges/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pledges'] });
      setInitial(values);
      navigate('/pledges');
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
      donor_id: Number(values.donor_id),
      fund_id: values.fund_id ? Number(values.fund_id) : null,
      total_pledged_amount: Number(values.total_pledged_amount),
      pledge_date: values.pledge_date,
      expected_fulfillment_date: values.expected_fulfillment_date || null,
      pledge_status_id: Number(values.pledge_status_id),
      solicitation_method_id: values.solicitation_method_id ? Number(values.solicitation_method_id) : null,
      notes: values.notes || null,
    };
    if (isNew) createMut.mutate(body);
    else updateMut.mutate(body);
  }

  function handleDelete() {
    if (!window.confirm('Permanently delete this pledge? Must have no linked donations.')) return;
    deleteMut.mutate();
  }

  const saving = createMut.isPending || updateMut.isPending;
  const title = !isNew && existing ? `${existing.pledge.donor_name} — pledge` : 'New pledge';

  return (
    <>
      <PageHeader
        title={isNew ? 'New' : title}
        emphasis={isNew ? 'pledge' : undefined}
        subtitle={isNew ? 'Record a commitment to give.' : `Editing pledge #${id}.`}
      />

      <FormNavBar
        listLabel="pledges" singularLabel="pledge" basePath="/pledges"
        isNew={isNew} prevId={null} nextId={null}
        isDirty={isDirty} savedFlash={savedFlash} onNav={safeNavigate}
      />

      {topError && <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
        <Section title="Pledge" hint="The commitment itself. Status flips automatically as payments come in.">
          <FieldGrid>
            {FIELDS.map(col => (
              <Cell key={col.name} col={col}>
                <Field
                  col={col}
                  value={values[col.name]}
                  initialFkLabel={initialFkLabel(existing?.pledge, col.name)}
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
                {deleteMut.isPending ? 'Deleting…' : 'Delete this pledge'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDirty && !saving && <span className="text-[11px] text-ink-faint italic">Unsaved changes</span>}
            <button type="button" onClick={() => safeNavigate(isNew ? '/pledges' : `/pledges/${id}`)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : (isNew ? 'Create pledge' : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function blankForm(): Record<string, any> {
  return {
    donor_id: null, fund_id: null, total_pledged_amount: '',
    pledge_date: '', expected_fulfillment_date: '',
    pledge_status_id: null, solicitation_method_id: null, notes: '',
  };
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function dateOnly(value: any): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function initialFkLabel(p: any, columnName: string): string | undefined {
  if (!p) return undefined;
  switch (columnName) {
    case 'donor_id':                 return p.donor_name;
    case 'fund_id':                  return p.fund_name;
    case 'pledge_status_id':         return p.pledge_status;
    case 'solicitation_method_id':   return p.solicitation_method;
    default: return undefined;
  }
}
