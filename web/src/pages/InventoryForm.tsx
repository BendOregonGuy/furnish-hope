/**
 * Create + edit form for a single inventory item.
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

const PLACEMENT_FIELDS: ColumnMeta[] = [
  { name: 'corp_facility_id',   label: 'Facility',         type: 'fk',  required: true, isPk: false, isFk: true, fkTable: 'tbl_corp_facility' },
  { name: 'storage_location_id', label: 'Storage location', type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'lkp_storage_location' },
];

const CLASSIFICATION_FIELDS: ColumnMeta[] = [
  { name: 'item_category_id',  label: 'Category',  type: 'fk', required: true, isPk: false, isFk: true, fkTable: 'lkp_item_category' },
  { name: 'item_size_id',      label: 'Size',      type: 'fk', required: true, isPk: false, isFk: true, fkTable: 'lkp_item_size' },
  { name: 'item_weight_id',    label: 'Weight',    type: 'fk', required: true, isPk: false, isFk: true, fkTable: 'lkp_item_weight' },
  { name: 'item_condition_id', label: 'Condition', type: 'fk', required: true, isPk: false, isFk: true, fkTable: 'lkp_item_condition' },
];

const VALUE_FIELDS: ColumnMeta[] = [
  { name: 'donation_value_in',  label: 'Intake value ($)',     type: 'money', required: true, isPk: false, isFk: false, scale: 2, helpText: 'Estimated value when received.' },
  { name: 'donation_value_out', label: 'Disposition value ($)', type: 'money', required: false, isPk: false, isFk: false, scale: 2, helpText: 'Set when the item is dispositioned (delivered, sold, etc.).' },
];

const LIFECYCLE_FIELDS: ColumnMeta[] = [
  { name: 'date_added_to_inventory', label: 'Date received',     type: 'date', required: true, isPk: false, isFk: false },
  { name: 'date_dispositioned',      label: 'Date dispositioned', type: 'date', required: false, isPk: false, isFk: false },
  { name: 'disposition_reason_id',   label: 'Disposition reason', type: 'fk',  required: false, isPk: false, isFk: true, fkTable: 'lkp_disposition_reason' },
  { name: 'donation_item_id',        label: 'Source donation item', type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'tbl_donation_item', helpText: 'Optional link back to the donation this item came from.' },
];

const DESCRIPTION_FIELDS: ColumnMeta[] = [
  { name: 'description', label: 'Description', type: 'textarea', required: false, isPk: false, isFk: false, maxLength: 100, helpText: 'A short label like "Queen mattress, blue" (max 100 characters).' },
];

const ALL_FIELDS = [...PLACEMENT_FIELDS, ...CLASSIFICATION_FIELDS, ...VALUE_FIELDS, ...LIFECYCLE_FIELDS, ...DESCRIPTION_FIELDS];

interface InventoryDetailResponse {
  item: any;
  reservations: any[];
  prevId: number | null;
  nextId: number | null;
}

export function InventoryForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading: loadingExisting, error: loadError } = useQuery<InventoryDetailResponse>({
    queryKey: ['inventory-item', id],
    queryFn: () => apiGet(`/api/inventory/${id}`),
    enabled: !isNew,
  });

  const [values, setValues] = useState<Record<string, any>>(() => blankFormState());
  const [initial, setInitial] = useState<Record<string, any>>(() => blankFormState());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<number | null>(null);

  useEffect(() => {
    setSubmitAttempted(false); setErrors({}); setTopError(null);
    if (isNew) {
      const blank = blankFormState();
      blank.date_added_to_inventory = todayIso();
      setValues(blank); setInitial(blank);
      return;
    }
    if (!existing) return;
    const i = existing.item;
    const v: Record<string, any> = {
      corp_facility_id:        i.corp_facility_id,
      storage_location_id:     i.storage_location_id,
      item_category_id:        i.item_category_id,
      item_size_id:            i.item_size_id,
      item_weight_id:          i.item_weight_id,
      item_condition_id:       i.item_condition_id,
      donation_value_in:       i.donation_value_in,
      donation_value_out:      i.donation_value_out,
      date_added_to_inventory: dateOnly(i.date_added_to_inventory),
      date_dispositioned:      dateOnly(i.date_dispositioned),
      disposition_reason_id:   i.disposition_reason_id,
      donation_item_id:        i.donation_item_id,
      description:             i.description ?? '',
    };
    setValues(v); setInitial(v);
  }, [existing, isNew]);

  const { isDirty, safeNavigate } = useUnsavedChanges({ values, initialValues: initial });

  const createMut = useMutation({
    mutationFn: (body: any) => apiPost<{ inv_id: number }>('/api/inventory', body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setInitial(values);
      navigate(`/inventory/${data.inv_id}`);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut<{ inv_id: number }>(`/api/inventory/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-item', id] });
      setInitial(values);
      setTopError(null);
      setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 2200);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setInitial(values);
      navigate('/inventory');
    },
    onError: (err: any) => setTopError(err.message ?? 'Delete failed'),
  });

  if (loadingExisting) return <Loading />;
  if (loadError) return <ErrorBox error={loadError} />;

  function setField(name: string, v: any) {
    setValues(prev => ({ ...prev, [name]: v }));
    if (submitAttempted) {
      const col = ALL_FIELDS.find(c => c.name === name);
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
    const errs = validateForm(ALL_FIELDS, values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setTopError('Please fix the highlighted fields.');
      const first = Object.keys(errs)[0];
      const el = document.getElementById(`field-${first}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setTopError(null);

    const body: any = {};
    for (const col of ALL_FIELDS) {
      const v = values[col.name];
      body[col.name] = v === '' || v === undefined ? null : v;
    }
    body.corp_facility_id = Number(body.corp_facility_id);
    body.item_category_id = Number(body.item_category_id);
    body.item_size_id = Number(body.item_size_id);
    body.item_weight_id = Number(body.item_weight_id);
    body.item_condition_id = Number(body.item_condition_id);
    body.donation_value_in = Number(body.donation_value_in);
    if (body.donation_value_out !== null) body.donation_value_out = Number(body.donation_value_out);

    if (isNew) createMut.mutate(body);
    else updateMut.mutate(body);
  }

  function handleDelete() {
    if (!window.confirm('Permanently delete this inventory item? This cannot be undone.')) return;
    deleteMut.mutate();
  }

  const saving = createMut.isPending || updateMut.isPending;
  const title = !isNew && existing?.item ? (existing.item.description || existing.item.item_category) : 'New inventory item';

  function renderField(col: ColumnMeta) {
    return (
      <Cell key={col.name} col={col}>
        <Field
          col={col}
          value={values[col.name]}
          initialFkLabel={initialFkLabel(existing?.item, col.name)}
          error={errors[col.name] ?? null}
          onChange={v => setField(col.name, v)}
        />
      </Cell>
    );
  }

  return (
    <>
      <PageHeader
        title={isNew ? 'New' : title}
        emphasis={isNew ? 'inventory item' : undefined}
        subtitle={isNew ? 'Add a new physical item to the warehouse inventory.' : `Editing inventory item #${id}.`}
      />

      <FormNavBar
        listLabel="inventory" singularLabel="item" basePath="/inventory"
        isNew={isNew} prevId={existing?.prevId ?? null} nextId={existing?.nextId ?? null}
        isDirty={isDirty} savedFlash={savedFlash} onNav={safeNavigate}
      />

      {topError && <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
        <Section title="Description" hint="What this item is, in plain English.">
          <FieldGrid>{DESCRIPTION_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Classification" hint="Used for matching to client requests.">
          <FieldGrid>{CLASSIFICATION_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Placement" hint="Where the item lives in the warehouse.">
          <FieldGrid>{PLACEMENT_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Value" hint="Estimated donation value for tax / reporting.">
          <FieldGrid>{VALUE_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Lifecycle" hint="When it arrived, when it left, why it left.">
          <FieldGrid>{LIFECYCLE_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <div className="card flex items-center justify-between gap-3">
          <div>
            {!isNew && (
              <button type="button" onClick={handleDelete} disabled={deleteMut.isPending}
                className="text-sm text-terracotta hover:text-terracotta-deep disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting…' : 'Delete this item'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDirty && !saving && <span className="text-[11px] text-ink-faint italic">Unsaved changes</span>}
            <button type="button" onClick={() => safeNavigate(isNew ? '/inventory' : `/inventory/${id}`)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : (isNew ? 'Create item' : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function blankFormState(): Record<string, any> {
  return {
    corp_facility_id: null, storage_location_id: null,
    item_category_id: null, item_size_id: null, item_weight_id: null, item_condition_id: null,
    donation_value_in: '', donation_value_out: '',
    date_added_to_inventory: '', date_dispositioned: '', disposition_reason_id: null,
    donation_item_id: null, description: '',
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

function initialFkLabel(item: any, columnName: string): string | undefined {
  if (!item) return undefined;
  switch (columnName) {
    case 'corp_facility_id':       return item.facility_name;
    case 'storage_location_id':    return item.location_code;
    case 'item_category_id':       return item.item_category;
    case 'item_size_id':           return item.item_size;
    case 'item_weight_id':         return item.item_weight;
    case 'item_condition_id':      return item.item_condition;
    case 'disposition_reason_id':  return item.disposition_reason;
    default: return undefined;
  }
}
