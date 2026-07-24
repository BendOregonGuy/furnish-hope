/**
 * Create + edit form for a Provisioning Request. Picks a client, sets the
 * fulfillment facility / origin / creator, and lets the user manage the
 * list of requested items inline.
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
import { FacilityStaffQuickCreateModal } from '../components/quickCreate/FacilityStaffQuickCreateModal.tsx';
import { FkSelect } from '../components/admin/FkSelect.tsx';
import { FormNavBar } from '../components/forms/FormNavBar.tsx';
import { Section, FieldGrid, Cell } from '../components/forms/FormSection.tsx';
import { SubformList, type SubformRow } from '../components/forms/SubformList.tsx';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.ts';

/* ----------------------------------------------------------------- */
/*  Field configs                                                     */
/* ----------------------------------------------------------------- */

type FieldDef = ColumnMeta;

const REQUEST_FIELDS: FieldDef[] = [
  { name: 'client_id',                                label: 'Client',               type: 'fk',       required: true, isPk: false, isFk: true, fkTable: 'tbl_client' },
  { name: 'fulfillment_corp_facility_id',             label: 'Fulfilling facility',  type: 'fk',       required: true, isPk: false, isFk: true, fkTable: 'tbl_corp_facility' },
  { name: 'request_receipt_origin_id',                label: 'How request came in',  type: 'fk',       required: true, isPk: false, isFk: true, fkTable: 'lkp_request_receipt_origin' },
  { name: 'client_request_creator_facility_staff_id', label: 'Recorded by',          type: 'fk',       required: true, isPk: false, isFk: true, fkTable: 'tbl_facility_staff' },
  { name: 'request_at',                               label: 'Request date & time',  type: 'datetime', required: true, isPk: false, isFk: false },
  { name: 'client_request_note',                      label: 'Caseworker note',      type: 'textarea', required: false, isPk: false, isFk: false, helpText: 'Any context the caseworker shared — preferences, special needs, etc.' },
];

interface RequestItem extends SubformRow {
  client_request_items_id?: number | null;
  item_category_id: number | null;
  item_notes: string | null;
  quantity: number;
  priority: string | null;
}

interface RequestDetailResponse {
  request: any;
  items: any[];
  matches: any[];
  prevId: number | null;
  nextId: number | null;
}

/* ----------------------------------------------------------------- */
/*  Component                                                         */
/* ----------------------------------------------------------------- */

export function RequestForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading: loadingExisting, error: loadError } = useQuery<RequestDetailResponse>({
    queryKey: ['request', id],
    queryFn: () => apiGet(`/api/requests/${id}`),
    enabled: !isNew,
  });

  const [values, setValues] = useState<Record<string, any>>(() => blankFormState());
  const [initial, setInitial] = useState<Record<string, any>>(() => blankFormState());
  const [items, setItems] = useState<RequestItem[]>([]);
  const [initialItems, setInitialItems] = useState<RequestItem[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<number | null>(null);

  /* Populate the form once we have data (or empty values for "new"). */
  useEffect(() => {
    setSubmitAttempted(false);
    setErrors({});
    setTopError(null);
    if (isNew) {
      const blank = blankFormState();
      // Default request_at to "now" for a new request.
      blank.request_at = nowLocalDatetime();
      setValues(blank);
      setInitial(blank);
      setItems([]);
      setInitialItems([]);
      return;
    }
    if (!existing) return;
    const r = existing.request;
    const v: Record<string, any> = {
      client_id:                                r.client_id,
      fulfillment_corp_facility_id:             r.fulfillment_corp_facility_id,
      request_receipt_origin_id:                r.request_receipt_origin_id,
      client_request_creator_facility_staff_id: r.client_request_creator_facility_staff_id,
      request_at:                               datetimeLocal(r.request_at),
      client_request_note:                      r.client_request_note ?? '',
      child_count:                              r.child_count ?? '',
      adult_female_count:                       r.adult_female_count ?? '',
      adult_male_count:                         r.adult_male_count ?? '',
    };
    const apiItems: RequestItem[] = existing.items.map((i: any) => ({
      client_request_items_id: i.client_request_items_id,
      item_category_id:        i.item_category_id,
      item_notes:              i.item_notes ?? '',
      quantity:                i.quantity,
      priority:                i.priority ?? '',
    }));
    setValues(v);
    setInitial(v);
    setItems(apiItems);
    setInitialItems(apiItems);
  }, [existing, isNew]);

  const { isDirty, safeNavigate } = useUnsavedChanges({
    values: { ...values, _items: items },
    initialValues: { ...initial, _items: initialItems },
  });

  /* Mutations */
  const createMut = useMutation({
    mutationFn: (body: any) => apiPost<{ request_id: number }>('/api/requests', body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      setInitial(values);
      setInitialItems(items);
      navigate(`/requests/${data.request_id}`);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut<{ request_id: number }>(`/api/requests/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      setInitial(values);
      setInitialItems(items);
      setTopError(null);
      setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 2200);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      setInitial(values);
      setInitialItems(items);
      navigate('/requests');
    },
    onError: (err: any) => setTopError(err.message ?? 'Delete failed'),
  });

  if (loadingExisting) return <Loading />;
  if (loadError) return <ErrorBox error={loadError} />;

  function setField(name: string, v: any) {
    setValues(prev => ({ ...prev, [name]: v }));
    if (submitAttempted) {
      const col = REQUEST_FIELDS.find(c => c.name === name);
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
    const errs = validateForm(REQUEST_FIELDS, values);
    if (items.length === 0) {
      errs._items = 'Add at least one requested item before saving.';
    } else {
      for (const item of items) {
        if (!item.item_category_id) { errs._items = 'Every item needs a category.'; break; }
        if (!item.quantity || item.quantity <= 0) { errs._items = 'Every item needs a quantity of 1 or more.'; break; }
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setTopError(`Please fix the highlighted ${Object.keys(errs).length === 1 ? 'field' : 'fields'} before saving.`);
      const firstName = Object.keys(errs)[0];
      if (firstName !== '_items') {
        const el = document.getElementById(`field-${firstName}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setTopError(null);

    const body = {
      client_id:                                Number(values.client_id),
      fulfillment_corp_facility_id:             Number(values.fulfillment_corp_facility_id),
      request_receipt_origin_id:                Number(values.request_receipt_origin_id),
      client_request_creator_facility_staff_id: Number(values.client_request_creator_facility_staff_id),
      request_at:                               toDatetimeIso(values.request_at),
      client_request_note:                      values.client_request_note || null,
      child_count:        values.child_count === '' || values.child_count == null ? null : Number(values.child_count),
      adult_female_count: values.adult_female_count === '' || values.adult_female_count == null ? null : Number(values.adult_female_count),
      adult_male_count:   values.adult_male_count === '' || values.adult_male_count == null ? null : Number(values.adult_male_count),
      items: items.map(it => ({
        client_request_items_id: it.client_request_items_id ?? null,
        item_category_id: Number(it.item_category_id),
        item_notes: it.item_notes || null,
        quantity: Number(it.quantity),
        priority: it.priority || null,
      })),
    };
    if (isNew) createMut.mutate(body);
    else updateMut.mutate(body);
  }

  function handleDelete() {
    if (!window.confirm(`Permanently delete this provisioning request and its items? This cannot be undone.`)) return;
    deleteMut.mutate();
  }

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <>
      <PageHeader
        helpSection="requests"
        title={isNew ? 'New' : `Edit request #${id}`}
        emphasis={isNew ? 'provisioning request' : undefined}
        subtitle={isNew ? 'Open a new request on behalf of a client.' : `Editing provisioning request #${id}.`}
      />

      <FormNavBar
        listLabel="requests" singularLabel="request" basePath="/requests"
        isNew={isNew} prevId={existing?.prevId ?? null} nextId={existing?.nextId ?? null}
        isDirty={isDirty} savedFlash={savedFlash} onNav={safeNavigate}
      />

      {topError && (
        <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
        <Section title="Request details" hint="Who, where, and when.">
          <FieldGrid>
            {REQUEST_FIELDS.map(col => {
              if (col.name === 'fulfillment_corp_facility_id') {
                return (
                  <Cell key={col.name} col={col}>
                    <FkCreateField
                      label={col.label} required={col.required} helpText={col.helpText}
                      error={errors[col.name] ?? null}
                      fkTable="tbl_corp_facility"
                      value={values.fulfillment_corp_facility_id ?? null}
                      onChange={v => setField('fulfillment_corp_facility_id', v)}
                      newButtonLabel="+ New facility"
                      renderModal={ctx => <CorpFacilityQuickCreateModal {...ctx} />}
                    />
                  </Cell>
                );
              }
              if (col.name === 'client_request_creator_facility_staff_id') {
                return (
                  <Cell key={col.name} col={col}>
                    <FkCreateField
                      label={col.label} required={col.required} helpText={col.helpText}
                      error={errors[col.name] ?? null}
                      fkTable="tbl_facility_staff"
                      value={values.client_request_creator_facility_staff_id ?? null}
                      onChange={v => setField('client_request_creator_facility_staff_id', v)}
                      newButtonLabel="+ New staff"
                      renderModal={ctx => <FacilityStaffQuickCreateModal {...ctx} />}
                    />
                  </Cell>
                );
              }
              return (
                <Cell key={col.name} col={col}>
                  <Field
                    col={col}
                    value={values[col.name]}
                    initialFkLabel={initialFkLabel(existing?.request, col.name)}
                    error={errors[col.name] ?? null}
                    onChange={v => setField(col.name, v)}
                  />
                </Cell>
              );
            })}
          </FieldGrid>
        </Section>

        <Section title="Household composition" hint="Optional — counts of children and adults served. Powers the Impact Data 'individuals served' report.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="field-label">Children</label>
              <input type="number" min={0} className="field-input" value={values.child_count ?? ''}
                onChange={e => setField('child_count', e.target.value)} />
            </div>
            <div>
              <label className="field-label">Female adults</label>
              <input type="number" min={0} className="field-input" value={values.adult_female_count ?? ''}
                onChange={e => setField('adult_female_count', e.target.value)} />
            </div>
            <div>
              <label className="field-label">Male adults</label>
              <input type="number" min={0} className="field-input" value={values.adult_male_count ?? ''}
                onChange={e => setField('adult_male_count', e.target.value)} />
            </div>
          </div>
        </Section>

        <Section
          title="Requested items"
          hint="What the household needs. Add a row per category."
          actions={errors._items && (
            <span className="text-[11px] text-terracotta-deep font-medium">{errors._items}</span>
          )}
        >
          <SubformList<RequestItem>
            rows={items}
            onChange={setItems}
            emptyHint="No items yet — add at least one before saving."
            addLabel="+ Add item"
            newRow={() => ({
              item_category_id: null,
              item_notes: '',
              quantity: 1,
              priority: 'Medium',
            })}
            headers={
              <div className="grid grid-cols-[1fr_80px_110px_1fr] gap-3">
                <div>Category</div>
                <div>Qty</div>
                <div>Priority</div>
                <div>Notes</div>
              </div>
            }
            renderRow={(row, update) => (
              <div className="grid grid-cols-[1fr_80px_110px_1fr] gap-3 items-start">
                <FkSelect
                  fkTable="lkp_item_category"
                  value={row.item_category_id}
                  required
                  onChange={v => update({ item_category_id: v })}
                />
                <input
                  type="number"
                  min={1}
                  className="field-input"
                  value={row.quantity ?? ''}
                  onChange={e => update({ quantity: e.target.value === '' ? (0 as any) : Number(e.target.value) })}
                />
                <select
                  className="field-input"
                  value={row.priority ?? ''}
                  onChange={e => update({ priority: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <input
                  type="text"
                  className="field-input"
                  placeholder="Notes (size, color, etc.)"
                  value={row.item_notes ?? ''}
                  onChange={e => update({ item_notes: e.target.value })}
                />
              </div>
            )}
          />
        </Section>

        <div className="card flex items-center justify-between gap-3">
          <div>
            {!isNew && (
              <button type="button" onClick={handleDelete} disabled={deleteMut.isPending}
                className="text-sm text-terracotta hover:text-terracotta-deep disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting…' : 'Delete this request'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDirty && !saving && <span className="text-[11px] text-ink-faint italic">Unsaved changes</span>}
            <button type="button" onClick={() => safeNavigate(isNew ? '/requests' : `/requests/${id}`)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : (isNew ? 'Create request' : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

/* ----------------------------------------------------------------- */
/*  Helpers                                                           */
/* ----------------------------------------------------------------- */

function blankFormState(): Record<string, any> {
  return {
    client_id: null,
    fulfillment_corp_facility_id: null,
    request_receipt_origin_id: null,
    client_request_creator_facility_staff_id: null,
    request_at: '',
    client_request_note: '',
    child_count: '',
    adult_female_count: '',
    adult_male_count: '',
  };
}

function nowLocalDatetime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDatetimeIso(local: string): string {
  // datetime-local gives "YYYY-MM-DDTHH:MM"; backend treats it as local time.
  return local.length === 16 ? local + ':00' : local;
}

function initialFkLabel(req: any, columnName: string): string | undefined {
  if (!req) return undefined;
  switch (columnName) {
    case 'client_id':                    return req.client_name;
    case 'fulfillment_corp_facility_id': return req.fulfillment_facility;
    default: return undefined;
  }
}
