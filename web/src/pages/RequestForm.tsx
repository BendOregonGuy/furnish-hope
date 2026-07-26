/**
 * Create + edit form for a Packing List (formerly "Provisioning Request").
 *
 * Redesigned around the warehouse pull-and-pack workflow: a room-grouped
 * checklist (pre-loaded from the editable home template), per-room
 * subtotals + "mark all pulled", a live pull progress bar, delivery /
 * pickup logistics for the crew, household composition (adults + per-child
 * rows), situation tags, and staff-only internal notes.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api.ts';
import type { ColumnMeta } from '../lib/admin.ts';
import { validateForm, type FormErrors } from '../lib/adminValidate.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { Field } from '../components/admin/Field.tsx';
import { FkCreateField } from '../components/admin/FkSelectWithCreate.tsx';
import { CorpFacilityQuickCreateModal } from '../components/quickCreate/CorpFacilityQuickCreateModal.tsx';
import { FacilityStaffQuickCreateModal } from '../components/quickCreate/FacilityStaffQuickCreateModal.tsx';
import { FormNavBar } from '../components/forms/FormNavBar.tsx';
import { Section, FieldGrid, Cell } from '../components/forms/FormSection.tsx';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.ts';

/* ----------------------------------------------------------------- */
/*  Static option lists                                               */
/* ----------------------------------------------------------------- */

const SITUATION_CHIPS = [
  'Recovery graduate', 'Asylum / refugee', 'Veteran', 'DV survivor',
  'Natural disaster', 'Houseless', 'Foster youth / family', 'Person with disability',
];
const TRAILER_SIZES = ['16 ft enclosed', '12 ft open', 'Box truck', 'Pickup + trailer', 'Cargo van'];
const CREW_SIZES = ['1', '2', '3', '4', '5'];
const CHILD_GENDERS = ['Girl', 'Boy', 'Other'];

/* Required request-level fields the API insists on. Kept as a small config so
 * validation + the "details" section stay metadata-driven. */
type FieldDef = ColumnMeta;
const REQUEST_FIELDS: FieldDef[] = [
  { name: 'client_id',                                label: 'Recipient (client)',  type: 'fk',       required: true, isPk: false, isFk: true, fkTable: 'tbl_client' },
  { name: 'fulfillment_corp_facility_id',             label: 'Fulfilling facility', type: 'fk',       required: true, isPk: false, isFk: true, fkTable: 'tbl_corp_facility' },
  { name: 'request_receipt_origin_id',                label: 'How it came in',      type: 'fk',       required: true, isPk: false, isFk: true, fkTable: 'lkp_request_receipt_origin' },
  { name: 'client_request_creator_facility_staff_id', label: 'Recorded by',         type: 'fk',       required: true, isPk: false, isFk: true, fkTable: 'tbl_facility_staff' },
  { name: 'request_at',                               label: 'Created',             type: 'datetime', required: true, isPk: false, isFk: false },
];

/* ----------------------------------------------------------------- */
/*  Local state shapes                                                */
/* ----------------------------------------------------------------- */

interface Item {
  _key: string;
  client_request_items_id?: number | null;
  item_name: string;
  item_category_id?: number | null;
  quantity: number;
  qty_given: number | null;
  pulled: boolean;
  is_na: boolean;
  is_declined: boolean;
  item_notes: string;
}
interface Room {
  _key: string;
  name: string;
  items: Item[];
}
interface Child {
  _key: string;
  request_child_id?: number | null;
  gender: string;
  age: string;   // kept as string for the input; coerced on submit
  notes: string;
}

interface RequestDetailResponse {
  request: any;
  items: any[];
  children?: any[];
  matches: any[];
  prevId: number | null;
  nextId: number | null;
}
interface TemplateResponse {
  rooms: Array<{ room_name: string; items: Array<{ item_name: string; default_qty: number; item_category_id: number | null }> }>;
}
interface ClientReferral {
  referral_id: number;
  referral_date?: string | null;
  agency_name: string;
  agency_is_approved?: boolean;
  caseworker_name: string;
  caseworker_email: string | null;
  caseworker_phone: string | null;
  referral_note?: string | null;
}

let keySeq = 0;
const nextKey = () => `k${++keySeq}-${Math.round(Math.random() * 1e6)}`;

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

  // The editable home checklist template (rooms + items). Used to pre-load a
  // brand-new packing list.
  const { data: template } = useQuery<TemplateResponse>({
    queryKey: ['packing-template'],
    queryFn: () => apiGet('/api/requests/template'),
    enabled: isNew,
    staleTime: 5 * 60 * 1000,
  });

  const [values, setValues] = useState<Record<string, any>>(() => blankValues());
  const [initial, setInitial] = useState<Record<string, any>>(() => blankValues());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [initialRooms, setInitialRooms] = useState<Room[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [initialChildren, setInitialChildren] = useState<Child[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [initialTags, setInitialTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const templateLoadedFor = useRef<string | null>(null);
  const savedFlashTimer = useRef<number | null>(null);

  // Referral / agency + caseworker for the selected client (if any). Fetched
  // whenever a client is chosen, so it works for both new and existing lists.
  const selectedClientId = values.client_id ? Number(values.client_id) : null;
  const { data: clientReferrals } = useQuery<ClientReferral[]>({
    queryKey: ['client-referrals', selectedClientId],
    // approvedOnly — only referrals from FH-approved agencies appear in the picker.
    queryFn: () => apiGet(`/api/clients/${selectedClientId}/referrals`, { approvedOnly: '1' }),
    enabled: !!selectedClientId,
    staleTime: 60 * 1000,
  });
  const referrals = clientReferrals ?? [];
  const selectedReferral = referrals.find(r => r.referral_id === Number(values.referral_id)) ?? null;

  /* Populate from an existing packing list. */
  useEffect(() => {
    if (isNew) return;
    if (!existing) return;
    const r = existing.request;
    const v = valuesFromRequest(r);
    const grouped = groupItemsByRoom(existing.items ?? []);
    const kids: Child[] = (existing.children ?? []).map((c: any) => ({
      _key: nextKey(), request_child_id: c.request_child_id,
      gender: c.gender ?? '', age: c.age == null ? '' : String(c.age), notes: c.notes ?? '',
    }));
    const tg = splitTags(r.situation_tags);
    setValues(v); setInitial(v);
    setRooms(grouped); setInitialRooms(deepCloneRooms(grouped));
    setChildren(kids); setInitialChildren(kids.map(k => ({ ...k })));
    setTags(tg); setInitialTags([...tg]);
    setSubmitAttempted(false); setErrors({}); setTopError(null);
  }, [existing, isNew]);

  /* Pre-load the template into a new packing list (once). */
  useEffect(() => {
    if (!isNew || !template) return;
    if (templateLoadedFor.current === 'new') return;
    templateLoadedFor.current = 'new';
    const blank = blankValues();
    blank.request_at = nowLocalDatetime();
    const seeded = roomsFromTemplate(template);
    setValues(blank); setInitial(blank);
    setRooms(seeded); setInitialRooms(deepCloneRooms(seeded));
    setChildren([]); setInitialChildren([]);
    setTags([]); setInitialTags([]);
  }, [isNew, template]);

  const { isDirty, safeNavigate } = useUnsavedChanges({
    values: { ...values, _rooms: rooms, _children: children, _tags: tags },
    initialValues: { ...initial, _rooms: initialRooms, _children: initialChildren, _tags: initialTags },
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiPost<{ request_id: number }>('/api/requests', body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      markClean();
      navigate(`/requests/${data.request_id}`);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });
  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut<{ request_id: number }>(`/api/requests/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      markClean();
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
      markClean();
      navigate('/requests');
    },
    onError: (err: any) => setTopError(err.message ?? 'Delete failed'),
  });

  function markClean() {
    setInitial(values);
    setInitialRooms(deepCloneRooms(rooms));
    setInitialChildren(children.map(c => ({ ...c })));
    setInitialTags([...tags]);
  }

  /* ---- Progress across all items ---- */
  const progress = useMemo(() => {
    let total = 0, pulled = 0, declined = 0;
    for (const room of rooms) for (const it of room.items) {
      total++;
      if (it.pulled) pulled++;
      if (it.is_declined) declined++;
    }
    return { total, pulled, declined, pct: total ? Math.round((pulled / total) * 100) : 0 };
  }, [rooms]);

  if (loadingExisting) return <Loading />;
  if (loadError) return <ErrorBox error={loadError} />;

  function setField(name: string, v: any) {
    setValues(prev => {
      const next = { ...prev, [name]: v };
      // A referral belongs to a specific client — changing the client invalidates it.
      if (name === 'client_id') next.referral_id = null;
      return next;
    });
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

  /* ---- Room / item mutations ---- */
  function patchRoom(rk: string, patch: Partial<Room>) {
    setRooms(rs => rs.map(r => (r._key === rk ? { ...r, ...patch } : r)));
  }
  function removeRoom(rk: string) {
    setRooms(rs => rs.filter(r => r._key !== rk));
  }
  function addRoom() {
    setRooms(rs => [...rs, { _key: nextKey(), name: 'New room', items: [blankItem('New item')] }]);
  }
  function patchItem(rk: string, ik: string, patch: Partial<Item>) {
    setRooms(rs => rs.map(r => r._key !== rk ? r : { ...r, items: r.items.map(it => it._key === ik ? { ...it, ...patch } : it) }));
  }
  function removeItem(rk: string, ik: string) {
    setRooms(rs => rs.map(r => r._key !== rk ? r : { ...r, items: r.items.filter(it => it._key !== ik) }));
  }
  function addItem(rk: string) {
    setRooms(rs => rs.map(r => r._key !== rk ? r : { ...r, items: [...r.items, blankItem('')] }));
  }
  function markAllPulled(rk: string) {
    setRooms(rs => rs.map(r => r._key !== rk ? r : { ...r, items: r.items.map(it => ({ ...it, pulled: true })) }));
  }
  function toggleTag(t: string) {
    setTags(cur => cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    const errs = validateForm(REQUEST_FIELDS, values);
    const flatItems = rooms.flatMap(r => r.items);
    if (flatItems.length === 0) {
      errs._items = 'Add at least one item before saving.';
    } else if (flatItems.some(it => !it.item_name.trim())) {
      errs._items = 'Every item needs a name (or remove the empty row).';
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

    let sort = 0;
    const items = rooms.flatMap(room => room.items.map(it => ({
      client_request_items_id: it.client_request_items_id ?? null,
      item_name: it.item_name.trim(),
      item_category_id: it.item_category_id ?? null,
      quantity: Number(it.quantity) || 0,
      qty_given: it.qty_given == null || (it.qty_given as any) === '' ? null : Number(it.qty_given),
      item_notes: it.item_notes || null,
      room: room.name || null,
      pulled: !!it.pulled,
      is_na: !!it.is_na,
      is_declined: !!it.is_declined,
      sort_order: sort++,
    })));

    const body = {
      client_id:                                Number(values.client_id),
      fulfillment_corp_facility_id:             Number(values.fulfillment_corp_facility_id),
      request_receipt_origin_id:                Number(values.request_receipt_origin_id),
      client_request_creator_facility_staff_id: Number(values.client_request_creator_facility_staff_id),
      request_at:                               toDatetimeIso(values.request_at),
      client_request_note:                      values.client_request_note || null,
      child_count:        emptyToNull(values.child_count),
      adult_female_count: emptyToNull(values.adult_female_count),
      adult_male_count:   emptyToNull(values.adult_male_count),
      fulfillment_type:         values.fulfillment_type || null,
      appointment_at:           values.appointment_at ? toDatetimeIso(values.appointment_at) : null,
      trailer_size:             values.trailer_size || null,
      crew_size:                emptyToNull(values.crew_size),
      loading_notes:            values.loading_notes || null,
      residence_type:           values.residence_type || null,
      delivery_logistics_notes: values.delivery_logistics_notes || null,
      situation_notes:          values.situation_notes || null,
      situation_tags:           tags.length ? tags.join(',') : null,
      internal_notes:           values.internal_notes || null,
      household_type:           values.household_type || null,
      referral_id:              values.referral_id ? Number(values.referral_id) : null,
      children: children
        .filter(c => c.gender || c.age || c.notes)
        .map(c => ({
          request_child_id: c.request_child_id ?? null,
          gender: c.gender || null,
          age: c.age === '' ? null : Number(c.age),
          notes: c.notes || null,
        })),
      items,
    };
    if (isNew) createMut.mutate(body);
    else updateMut.mutate(body);
  }

  function handleDelete() {
    if (!window.confirm('Permanently delete this packing list and its items? This cannot be undone.')) return;
    deleteMut.mutate();
  }

  const saving = createMut.isPending || updateMut.isPending;
  const refCode = existing?.request?.reference_code as string | undefined;
  const isDelivery = (values.fulfillment_type ?? 'delivery') !== 'pickup';

  return (
    <>
      <PageHeader
        helpSection="requests"
        title={isNew ? 'New' : (existing?.request?.client_name ?? `Packing list #${id}`)}
        emphasis={isNew ? 'packing list' : undefined}
        subtitle={isNew
          ? 'Build the pull-and-pack checklist for a household.'
          : `${refCode ? refCode + ' · ' : ''}Editing packing list${existing?.request?.agency_name ? ' · referred by ' + existing.request.agency_name : ''}.`}
      />

      <FormNavBar
        listLabel="packing lists" singularLabel="packing list" basePath="/requests"
        isNew={isNew} prevId={existing?.prevId ?? null} nextId={existing?.nextId ?? null}
        isDirty={isDirty} savedFlash={savedFlash} onNav={safeNavigate}
      />

      {topError && (
        <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
        {/* ---- Details ---- */}
        <Section title="Packing list details" hint="Who it's for, where it's fulfilled from, and when it was opened.">
          <FieldGrid>
            {REQUEST_FIELDS.map(col => {
              if (col.name === 'fulfillment_corp_facility_id') {
                return (
                  <Cell key={col.name} col={col}>
                    <FkCreateField
                      label={col.label} required={col.required}
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
                      label={col.label} required={col.required}
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

          {/* Approved Referral — pick which FH-approved agency referral this
              packing list serves; the caseworker + contact info below update
              to match. Only shown when the client has approved referrals. */}
          {selectedClientId && referrals.length > 0 && (
            <div className="mt-4">
              <label className="field-label">Approved referral</label>
              <select
                className="field-input"
                value={values.referral_id ?? ''}
                onChange={e => setField('referral_id', e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">— No referral (walk-in / direct) —</option>
                {referrals.map(r => (
                  <option key={r.referral_id} value={r.referral_id}>
                    {r.agency_name}
                    {r.referral_date ? ` · ${new Date(r.referral_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                    {r.caseworker_name ? ` · ${r.caseworker_name}` : ''}
                  </option>
                ))}
              </select>

              {selectedReferral && (
                <div className="mt-2 rounded-md border border-hairline bg-cream/60 px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="pill pill-sage">Approved referral</span>
                    <span className="text-sm font-medium text-ink">{selectedReferral.agency_name}</span>
                    {selectedReferral.referral_date && (
                      <span className="text-xs text-ink-faint">referred {new Date(selectedReferral.referral_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    )}
                  </div>
                  <div className="text-xs text-ink-soft mt-1.5">
                    Caseworker: <span className="text-ink font-medium">{selectedReferral.caseworker_name}</span>
                    {selectedReferral.caseworker_email && <> · {selectedReferral.caseworker_email}</>}
                    {selectedReferral.caseworker_phone && <> · {selectedReferral.caseworker_phone}</>}
                  </div>
                  {selectedReferral.referral_note && (
                    <div className="text-xs text-ink-soft mt-1.5 italic">“{selectedReferral.referral_note}”</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            <label className="field-label">Caseworker note</label>
            <textarea className="field-input" rows={2}
              placeholder="Any context the caseworker shared — preferences, special needs, etc."
              value={values.client_request_note ?? ''}
              onChange={e => setField('client_request_note', e.target.value)} />
          </div>
        </Section>

        {/* ---- Fulfillment & logistics ---- */}
        <Section title="Fulfillment & logistics" hint="How the goods reach the household, and what the crew needs to know.">
          <div className="flex items-center gap-2 mb-4">
            <Segmented
              value={isDelivery ? 'delivery' : 'pickup'}
              onChange={v => setField('fulfillment_type', v)}
              options={[{ value: 'delivery', label: 'Delivery requested' }, { value: 'pickup', label: 'Donation-center pickup' }]}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Appointment</label>
              <input type="datetime-local" className="field-input"
                value={values.appointment_at ?? ''}
                onChange={e => setField('appointment_at', e.target.value)} />
            </div>
            <div>
              <label className="field-label">Residence type</label>
              <input type="text" className="field-input"
                placeholder="Apartment · 1st floor · no elevator…"
                value={values.residence_type ?? ''}
                onChange={e => setField('residence_type', e.target.value)} />
            </div>
            {isDelivery && (
              <>
                <div>
                  <label className="field-label">Trailer / vehicle</label>
                  <select className="field-input" value={values.trailer_size ?? ''}
                    onChange={e => setField('trailer_size', e.target.value)}>
                    <option value="">Select…</option>
                    {TRAILER_SIZES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Crew size</label>
                  <select className="field-input" value={values.crew_size ?? ''}
                    onChange={e => setField('crew_size', e.target.value)}>
                    <option value="">—</option>
                    {CREW_SIZES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="mt-4">
            <label className="field-label">Loading notes</label>
            <textarea className="field-input" rows={2}
              placeholder="Access, gate code, where to park…"
              value={values.loading_notes ?? ''}
              onChange={e => setField('loading_notes', e.target.value)} />
          </div>
          <div className="mt-4">
            <label className="field-label">Logistics for the crew</label>
            <textarea className="field-input" rows={2}
              placeholder="Stairs at entry, street parking only, 1st floor…"
              value={values.delivery_logistics_notes ?? ''}
              onChange={e => setField('delivery_logistics_notes', e.target.value)} />
          </div>
        </Section>

        {/* ---- Household composition ---- */}
        <Section title="Household composition" hint="Counts of adults and children served. Powers the Impact Data 'individuals served' report.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="field-label">Type</label>
              <select className="field-input" value={values.household_type ?? ''}
                onChange={e => setField('household_type', e.target.value)}>
                <option value="">—</option>
                <option value="individual">Individual</option>
                <option value="family">Family</option>
              </select>
            </div>
            <div>
              <label className="field-label">Adult females</label>
              <input type="number" min={0} className="field-input" value={values.adult_female_count ?? ''}
                onChange={e => setField('adult_female_count', e.target.value)} />
            </div>
            <div>
              <label className="field-label">Adult males</label>
              <input type="number" min={0} className="field-input" value={values.adult_male_count ?? ''}
                onChange={e => setField('adult_male_count', e.target.value)} />
            </div>
          </div>

          <div className="mt-5">
            <label className="field-label">Children <span className="normal-case text-ink-faint">(age &amp; gender)</span></label>
            {children.length === 0 && (
              <div className="text-xs text-ink-faint italic py-1">No children recorded.</div>
            )}
            <div className="space-y-2">
              {children.map(c => (
                <div key={c._key} className="grid grid-cols-[1fr_90px_1fr_32px] gap-2 items-center">
                  <select className="field-input" value={c.gender}
                    onChange={e => setChildren(cs => cs.map(x => x._key === c._key ? { ...x, gender: e.target.value } : x))}>
                    <option value="">Gender…</option>
                    {CHILD_GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input type="number" min={0} className="field-input" placeholder="Age" value={c.age}
                    onChange={e => setChildren(cs => cs.map(x => x._key === c._key ? { ...x, age: e.target.value } : x))} />
                  <input type="text" className="field-input" placeholder="Notes (bed size, etc.)" value={c.notes}
                    onChange={e => setChildren(cs => cs.map(x => x._key === c._key ? { ...x, notes: e.target.value } : x))} />
                  <button type="button" title="Remove child"
                    className="text-ink-faint hover:text-terracotta text-lg leading-none"
                    onClick={() => setChildren(cs => cs.filter(x => x._key !== c._key))}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="mt-2 text-xs text-terracotta hover:text-terracotta-deep font-medium"
              onClick={() => setChildren(cs => [...cs, { _key: nextKey(), gender: '', age: '', notes: '' }])}>
              + Add child
            </button>
          </div>
        </Section>

        {/* ---- Need & situation ---- */}
        <Section title="Need & situation" hint="Tag the household's situation and add any context.">
          <div className="flex flex-wrap gap-2">
            {SITUATION_CHIPS.map(t => {
              const on = tags.includes(t);
              return (
                <button key={t} type="button" onClick={() => toggleTag(t)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    on ? 'bg-terracotta text-paper border-terracotta'
                       : 'bg-paper text-ink-soft border-hairline-strong hover:border-terracotta'}`}>
                  {t}
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <label className="field-label">Situation notes</label>
            <textarea className="field-input" rows={2}
              placeholder="Context the caseworker shared — preferences, urgency, special needs…"
              value={values.situation_notes ?? ''}
              onChange={e => setField('situation_notes', e.target.value)} />
          </div>
        </Section>

        {/* ---- Items: pull & pack checklist ---- */}
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="font-display font-medium text-[17px] m-0">Items — pull &amp; pack checklist</h3>
              <div className="text-xs text-ink-faint mt-0.5">Room names are editable · edit, add, or remove anything per household.</div>
            </div>
            {errors._items && <span className="text-[11px] text-terracotta-deep font-medium">{errors._items}</span>}
          </div>

          {/* progress bar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-2 bg-cream-deep rounded-full overflow-hidden">
              <div className="h-full bg-sage transition-all" style={{ width: `${progress.pct}%` }} />
            </div>
            <div className="text-xs text-ink-soft whitespace-nowrap">
              <strong className="text-ink">{progress.pulled}</strong> of <strong className="text-ink">{progress.total}</strong> pulled
              {progress.declined > 0 && <> · <strong className="text-ink">{progress.declined}</strong> declined</>}
            </div>
          </div>

          <div className="space-y-4">
            {rooms.map(room => {
              const pulled = room.items.filter(i => i.pulled).length;
              return (
                <div key={room._key} className="border border-hairline rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-cream border-b border-hairline">
                    <input
                      className="font-display font-medium text-sm text-terracotta-deep bg-transparent border border-transparent hover:border-hairline-strong focus:border-terracotta focus:bg-paper rounded px-1.5 py-1 w-48 outline-none"
                      value={room.name}
                      onChange={e => patchRoom(room._key, { name: e.target.value })} />
                    <span className="text-[11px] text-ink-faint whitespace-nowrap ml-auto">{pulled} / {room.items.length} pulled</span>
                    <button type="button" className="text-[11px] text-terracotta hover:text-terracotta-deep font-medium whitespace-nowrap"
                      onClick={() => markAllPulled(room._key)}>✓ Mark all pulled</button>
                    <button type="button" title="Remove room" className="text-ink-faint hover:text-terracotta text-base leading-none"
                      onClick={() => removeRoom(room._key)}>×</button>
                  </div>

                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-[10px] tracking-wider uppercase text-ink-faint">
                        <th className="text-left font-medium px-2.5 py-1.5 border-b border-hairline">Item</th>
                        <th className="font-medium px-1 py-1.5 border-b border-hairline w-14">Pulled</th>
                        <th className="font-medium px-1 py-1.5 border-b border-hairline w-16">Qty req.</th>
                        <th className="font-medium px-1 py-1.5 border-b border-hairline w-16">Qty given</th>
                        <th className="font-medium px-1 py-1.5 border-b border-hairline w-10">N/A</th>
                        <th className="font-medium px-1 py-1.5 border-b border-hairline w-14">Declined</th>
                        <th className="text-left font-medium px-2.5 py-1.5 border-b border-hairline">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {room.items.map(it => (
                        <tr key={it._key} className="border-b border-hairline last:border-0">
                          <td className="px-2.5 py-1.5 align-middle">
                            <input className="w-full bg-transparent border border-transparent hover:border-hairline focus:border-terracotta rounded px-1 py-1 text-sm font-medium outline-none"
                              value={it.item_name}
                              placeholder="Item name"
                              onChange={e => patchItem(room._key, it._key, { item_name: e.target.value })} />
                          </td>
                          <td className="text-center px-1 py-1.5">
                            <button type="button" onClick={() => patchItem(room._key, it._key, { pulled: !it.pulled })}
                              className={`w-5 h-5 rounded border-[1.5px] inline-flex items-center justify-center text-xs ${
                                it.pulled ? 'bg-sage border-sage text-white' : 'bg-paper border-hairline-strong text-transparent'}`}>✓</button>
                          </td>
                          <td className="text-center px-1 py-1.5">
                            <input type="number" min={0}
                              className="w-12 text-center bg-cream border border-hairline-strong rounded px-1 py-1 text-sm"
                              value={it.quantity}
                              onChange={e => patchItem(room._key, it._key, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })} />
                          </td>
                          <td className="text-center px-1 py-1.5">
                            <input type="number" min={0}
                              className="w-12 text-center bg-cream border border-hairline-strong rounded px-1 py-1 text-sm"
                              value={it.qty_given ?? ''}
                              onChange={e => patchItem(room._key, it._key, { qty_given: e.target.value === '' ? null : Number(e.target.value) })} />
                          </td>
                          <td className="text-center px-1 py-1.5">
                            <input type="checkbox" checked={it.is_na}
                              onChange={e => patchItem(room._key, it._key, { is_na: e.target.checked })} />
                          </td>
                          <td className="text-center px-1 py-1.5">
                            <input type="checkbox" checked={it.is_declined}
                              onChange={e => patchItem(room._key, it._key, { is_declined: e.target.checked })} />
                          </td>
                          <td className="px-2.5 py-1.5">
                            <div className="flex items-center gap-1">
                              <input className="w-full bg-cream border border-hairline rounded px-2 py-1 text-xs"
                                placeholder="Notes"
                                value={it.item_notes}
                                onChange={e => patchItem(room._key, it._key, { item_notes: e.target.value })} />
                              <button type="button" title="Remove item"
                                className="text-ink-faint hover:text-terracotta text-base leading-none px-1"
                                onClick={() => removeItem(room._key, it._key)}>×</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 bg-cream">
                    <button type="button" className="text-xs text-terracotta hover:text-terracotta-deep font-medium"
                      onClick={() => addItem(room._key)}>+ Add item</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button type="button" className="btn-ghost text-xs py-1.5" onClick={addRoom}>+ Add room</button>
            <span className="text-[11px] text-ink-faint">Rooms &amp; items are a starting template — edit freely per family.</span>
          </div>
        </div>

        {/* ---- Internal notes ---- */}
        <div className="rounded-[10px] p-5 bg-[#2A241D] text-[#E8DFCD]">
          <h3 className="font-display font-medium text-sm tracking-wider uppercase text-[#F7F1E8] m-0 flex items-center gap-2">🔒 Internal notes</h3>
          <div className="text-[11px] text-[#E8DFCD]/60 mt-1 mb-2">Staff-only — never shown to caseworkers or recipients.</div>
          <textarea rows={2}
            className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/10 text-[#F7F1E8] placeholder:text-[#E8DFCD]/40 focus:outline-none focus:border-white/30"
            placeholder="Anything the warehouse / delivery team should know…"
            value={values.internal_notes ?? ''}
            onChange={e => setField('internal_notes', e.target.value)} />
        </div>

        {/* ---- Action bar ---- */}
        <div className="card flex items-center justify-between gap-3">
          <div>
            {!isNew && (
              <button type="button" onClick={handleDelete} disabled={deleteMut.isPending}
                className="text-sm text-terracotta hover:text-terracotta-deep disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting…' : 'Delete this packing list'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDirty && !saving && <span className="text-[11px] text-ink-faint italic">Unsaved changes</span>}
            <button type="button" onClick={() => safeNavigate(isNew ? '/requests' : `/requests/${id}`)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : (isNew ? 'Create packing list' : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

/* ----------------------------------------------------------------- */
/*  Small presentational helper                                       */
/* ----------------------------------------------------------------- */

function Segmented({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="inline-flex border border-hairline-strong rounded-md overflow-hidden bg-cream">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`px-3.5 py-1.5 text-sm ${value === o.value ? 'bg-terracotta text-paper font-medium' : 'text-ink-soft'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Pure helpers                                                      */
/* ----------------------------------------------------------------- */

function blankItem(name: string): Item {
  return { _key: nextKey(), item_name: name, item_category_id: null, quantity: 1, qty_given: null, pulled: false, is_na: false, is_declined: false, item_notes: '' };
}

function blankValues(): Record<string, any> {
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
    fulfillment_type: 'delivery',
    appointment_at: '',
    trailer_size: '',
    crew_size: '',
    loading_notes: '',
    residence_type: '',
    delivery_logistics_notes: '',
    situation_notes: '',
    internal_notes: '',
    household_type: '',
    referral_id: null,
  };
}

function valuesFromRequest(r: any): Record<string, any> {
  return {
    client_id: r.client_id,
    fulfillment_corp_facility_id: r.fulfillment_corp_facility_id,
    request_receipt_origin_id: r.request_receipt_origin_id,
    client_request_creator_facility_staff_id: r.client_request_creator_facility_staff_id,
    request_at: datetimeLocal(r.request_at),
    client_request_note: r.client_request_note ?? '',
    child_count: r.child_count ?? '',
    adult_female_count: r.adult_female_count ?? '',
    adult_male_count: r.adult_male_count ?? '',
    fulfillment_type: r.fulfillment_type ?? 'delivery',
    appointment_at: r.appointment_at ? datetimeLocal(r.appointment_at) : '',
    trailer_size: r.trailer_size ?? '',
    crew_size: r.crew_size == null ? '' : String(r.crew_size),
    loading_notes: r.loading_notes ?? '',
    residence_type: r.residence_type ?? '',
    delivery_logistics_notes: r.delivery_logistics_notes ?? '',
    situation_notes: r.situation_notes ?? '',
    internal_notes: r.internal_notes ?? '',
    household_type: r.household_type ?? '',
    referral_id: r.referral_id ?? null,
  };
}

function groupItemsByRoom(apiItems: any[]): Room[] {
  const order: string[] = [];
  const byRoom = new Map<string, Item[]>();
  for (const i of apiItems) {
    const roomName = (i.room ?? '').trim() || 'Items';
    if (!byRoom.has(roomName)) { byRoom.set(roomName, []); order.push(roomName); }
    byRoom.get(roomName)!.push({
      _key: nextKey(),
      client_request_items_id: i.client_request_items_id,
      item_name: i.item_name ?? i.item_category ?? '',
      item_category_id: i.item_category_id ?? null,
      quantity: i.quantity ?? 1,
      qty_given: i.qty_given ?? null,
      pulled: !!i.pulled,
      is_na: !!i.is_na,
      is_declined: !!i.is_declined,
      item_notes: i.item_notes ?? '',
    });
  }
  return order.map(name => ({ _key: nextKey(), name, items: byRoom.get(name)! }));
}

function roomsFromTemplate(t: TemplateResponse): Room[] {
  return t.rooms.map(r => ({
    _key: nextKey(),
    name: r.room_name,
    items: r.items.map(i => ({
      _key: nextKey(),
      item_name: i.item_name,
      item_category_id: i.item_category_id ?? null,
      quantity: i.default_qty ?? 1,
      qty_given: null,
      pulled: false,
      is_na: false,
      is_declined: false,
      item_notes: '',
    })),
  }));
}

function deepCloneRooms(rooms: Room[]): Room[] {
  return rooms.map(r => ({ ...r, items: r.items.map(it => ({ ...it })) }));
}

function splitTags(v: string | null | undefined): string[] {
  if (!v) return [];
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

function emptyToNull(v: any): number | null {
  return v === '' || v == null ? null : Number(v);
}

function nowLocalDatetime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function datetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toDatetimeIso(local: string): string {
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
