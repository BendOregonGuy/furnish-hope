/**
 * Single form used for both creating and editing a Client. A "client" is
 * really three linked rows in the DB (contact + optional address + client),
 * but the user sees one coherent page split into sections.
 *
 * Reuses the admin form's Field + validation infrastructure so the look
 * and feel stays consistent across the app.
 *
 *   /clients/new        — create
 *   /clients/:id/edit   — edit existing
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api.ts';
import type { ColumnMeta } from '../lib/admin.ts';
import { validateForm, type FormErrors } from '../lib/adminValidate.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { Field } from '../components/admin/Field.tsx';
import { DedupSuggestions } from '../components/DedupSuggestions.tsx';

/* ----------------------------------------------------------------- */
/*  Field configs                                                     */
/* ----------------------------------------------------------------- */

/**
 * ColumnMeta-shaped configs let us reuse the admin Field renderer and the
 * shared validator without dragging in a separate form library. The `name`
 * is the key in our local form-state — section-prefixed to avoid collisions
 * (e.g. there are multiple "address_id" floating around the schema).
 */
type FieldDef = ColumnMeta & { name: string };

const PERSON_FIELDS: FieldDef[] = [
  { name: 'first_name',  label: 'First name',    type: 'text', required: true,  isPk: false, isFk: false, maxLength: 50 },
  { name: 'middle_name', label: 'Middle name',   type: 'text', required: false, isPk: false, isFk: false, maxLength: 50 },
  { name: 'last_name',   label: 'Last name',     type: 'text', required: true,  isPk: false, isFk: false, maxLength: 50 },
  { name: 'birth_date',  label: 'Date of birth', type: 'date', required: false, isPk: false, isFk: false },
  { name: 'gender_id',         label: 'Gender',         type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'lkp_gender' },
  { name: 'ethnicity_id',      label: 'Ethnicity',      type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'lkp_ethnicity' },
  { name: 'citizen_status_id', label: 'Citizen status', type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'lkp_citizen_status' },
];

const CONTACT_FIELDS: FieldDef[] = [
  { name: 'mobile_phone', label: 'Mobile phone', type: 'text', required: false, isPk: false, isFk: false, maxLength: 20 },
  { name: 'home_phone',   label: 'Home phone',   type: 'text', required: false, isPk: false, isFk: false, maxLength: 20 },
  { name: 'other_phone',  label: 'Other phone',  type: 'text', required: false, isPk: false, isFk: false, maxLength: 20 },
  { name: 'email',        label: 'Email',        type: 'text', required: false, isPk: false, isFk: false, maxLength: 100 },
];

const ADDRESS_FIELDS: FieldDef[] = [
  { name: 'address_name',    label: 'Label',        type: 'text', required: true, isPk: false, isFk: false, maxLength: 50,  helpText: 'e.g. "Home", "Apartment", "Temporary shelter"' },
  { name: 'address_type_id', label: 'Type',         type: 'fk',   required: true, isPk: false, isFk: true,  fkTable: 'lkp_address_type' },
  { name: 'address',         label: 'Street address', type: 'text', required: true, isPk: false, isFk: false, maxLength: 100 },
  { name: 'address2',        label: 'Apt / suite',  type: 'text', required: false, isPk: false, isFk: false, maxLength: 50 },
  { name: 'city_id',         label: 'City',         type: 'fk',   required: true, isPk: false, isFk: true,  fkTable: 'lkp_city' },
  { name: 'county_id',       label: 'County',       type: 'fk',   required: true, isPk: false, isFk: true,  fkTable: 'lkp_county' },
  { name: 'state_id',        label: 'State',        type: 'fk',   required: true, isPk: false, isFk: true,  fkTable: 'lkp_state' },
  { name: 'postalcode',      label: 'ZIP / postal code', type: 'text', required: true, isPk: false, isFk: false, maxLength: 10 },
];

const CLIENT_FIELDS: FieldDef[] = [
  { name: 'client_type_id',   label: 'Client type', type: 'fk',   required: true,  isPk: false, isFk: true, fkTable: 'lkp_client_type' },
  { name: 'client_status_id', label: 'Status',      type: 'fk',   required: true,  isPk: false, isFk: true, fkTable: 'lkp_client_status' },
  { name: 'start_date',       label: 'Intake date', type: 'date', required: false, isPk: false, isFk: false },
  { name: 'description',      label: 'Notes',       type: 'textarea', required: false, isPk: false, isFk: false, maxLength: 100, helpText: 'Brief notes about this client (max 100 characters).' },
];

const ALL_NON_ADDRESS = [...PERSON_FIELDS, ...CONTACT_FIELDS, ...CLIENT_FIELDS];
const ALL_INCLUDING_ADDRESS = [...ALL_NON_ADDRESS, ...ADDRESS_FIELDS];

/* ----------------------------------------------------------------- */
/*  Component                                                         */
/* ----------------------------------------------------------------- */

interface ClientDetailResponse {
  client: any;
  prevId: number | null;
  nextId: number | null;
}

export function ClientForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* ---------- Existing-client fetch ---------- */
  const { data: existing, isLoading: loadingExisting, error: loadError } = useQuery<ClientDetailResponse>({
    queryKey: ['client', id],
    queryFn: () => apiGet(`/api/clients/${id}`),
    enabled: !isNew,
  });

  /* ---------- Form state ---------- */
  const [values, setValues] = useState<Record<string, any>>(() => blankFormState());
  const [initial, setInitial] = useState<Record<string, any>>(() => blankFormState());
  const [hasAddress, setHasAddress] = useState<boolean>(false);
  const [initialHasAddress, setInitialHasAddress] = useState<boolean>(false);
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
      setValues(blank);
      setInitial(blank);
      setHasAddress(false);
      setInitialHasAddress(false);
      return;
    }
    if (!existing) return;
    const c = existing.client;
    const v: Record<string, any> = {
      first_name:         c.first_name ?? '',
      middle_name:        c.middle_name ?? '',
      last_name:          c.last_name ?? '',
      birth_date:         dateOnly(c.birth_date),
      gender_id:          c.gender_id ?? null,
      ethnicity_id:       c.ethnicity_id ?? null,
      citizen_status_id:  c.citizen_status_id ?? null,
      mobile_phone:       c.mobile_phone ?? '',
      home_phone:         c.home_phone ?? '',
      other_phone:        c.other_phone ?? '',
      email:              c.email ?? '',
      address_name:       c.address_name ?? '',
      address_type_id:    c.address_type_id ?? null,
      address:            c.address ?? '',
      address2:           c.address2 ?? '',
      city_id:            c.city_id ?? null,
      county_id:          c.county_id ?? null,
      state_id:           c.state_id ?? null,
      postalcode:         c.postalcode ?? '',
      client_type_id:     c.client_type_id ?? null,
      client_status_id:   c.client_status_id ?? null,
      start_date:         dateOnly(c.start_date),
      description:        c.description ?? '',
    };
    const hasAddr = !!c.address_id;
    setValues(v);
    setInitial(v);
    setHasAddress(hasAddr);
    setInitialHasAddress(hasAddr);
  }, [existing, isNew]);

  /* ---------- Dirty tracking + browser unload guard ---------- */
  const isDirty = useMemo(
    () => hasAddress !== initialHasAddress || isDirtyValues(values, initial),
    [values, initial, hasAddress, initialHasAddress],
  );

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  function safeNavigate(to: string) {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Leave this page anyway?')) return;
    }
    navigate(to);
  }

  /* ---------- Mutations ---------- */
  const createMut = useMutation({
    mutationFn: (body: any) => apiPost<{ client_id: number }>('/api/clients', body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      // Mark clean before nav so the safeNavigate doesn't prompt.
      setInitial(values);
      setInitialHasAddress(hasAddress);
      navigate(`/clients/${data.client_id}`);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut<{ client_id: number }>(`/api/clients/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      setInitial(values);
      setInitialHasAddress(hasAddress);
      setTopError(null);
      setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 2200);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setInitial(values);
      setInitialHasAddress(hasAddress);
      navigate('/clients');
    },
    onError: (err: any) => setTopError(err.message ?? 'Delete failed'),
  });

  /* ---------- Render guards ---------- */
  if (loadingExisting) return <Loading />;
  if (loadError) return <ErrorBox error={loadError} />;

  /* ---------- Handlers ---------- */
  function setField(name: string, v: any) {
    setValues(prev => ({ ...prev, [name]: v }));
    if (submitAttempted) {
      const allFields = hasAddress ? ALL_INCLUDING_ADDRESS : ALL_NON_ADDRESS;
      const col = allFields.find(c => c.name === name);
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
    const fieldsToValidate = hasAddress ? ALL_INCLUDING_ADDRESS : ALL_NON_ADDRESS;
    const errs = validateForm(fieldsToValidate, values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setTopError(`Please fix the highlighted ${Object.keys(errs).length === 1 ? 'field' : 'fields'} before saving.`);
      const firstName = Object.keys(errs)[0];
      const el = document.getElementById(`field-${firstName}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setTopError(null);

    const body = {
      contact: pickFields(values, ['first_name', 'middle_name', 'last_name', 'birth_date', 'gender_id', 'ethnicity_id', 'citizen_status_id', 'mobile_phone', 'home_phone', 'other_phone', 'email']),
      address: hasAddress ? pickFields(values, ['address_name', 'address_type_id', 'address', 'address2', 'city_id', 'county_id', 'state_id', 'postalcode']) : null,
      client: pickFields(values, ['client_type_id', 'client_status_id', 'start_date', 'description']),
    };
    if (isNew) createMut.mutate(body);
    else updateMut.mutate(body);
  }

  function handleDelete() {
    const fullName = `${values.first_name} ${values.last_name}`.trim() || 'this client';
    const ok = window.confirm(`Permanently delete ${fullName}? This will also clean up their contact and address records. This cannot be undone.`);
    if (ok) deleteMut.mutate();
  }

  function handleRemoveAddress() {
    if (!window.confirm('Remove this address from the client? The address record will be unlinked but not deleted.')) return;
    setHasAddress(false);
  }

  const saving = createMut.isPending || updateMut.isPending;
  const deleting = deleteMut.isPending;
  const fullName = `${values.first_name} ${values.last_name}`.trim();

  return (
    <>
      <PageHeader
        helpSection="clients-adding"
        title={isNew ? 'New' : (fullName || 'Edit')}
        emphasis={isNew ? 'client' : undefined}
        subtitle={isNew ? 'Add a new client (household) to the system.' : `Editing client #${id}.`}
      />

      {/* Top nav bar */}
      <ClientNavBar
        isNew={isNew}
        prevId={existing?.prevId ?? null}
        nextId={existing?.nextId ?? null}
        isDirty={isDirty}
        savedFlash={savedFlash}
        onNav={safeNavigate}
      />

      {topError && (
        <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>
      )}

      {isNew && (
        <DedupSuggestions
          apiPath="/api/clients/search"
          first_name={values.first_name ?? ''}
          last_name={values.last_name ?? ''}
          birth_date={values.birth_date ?? ''}
          mobile_phone={values.mobile_phone ?? ''}
          email={values.email ?? ''}
          onPickExisting={(c) => {
            // Mark form clean so safeNavigate doesn't trigger the unsaved
            // changes guard — picking an existing match means abandoning
            // this new record on purpose.
            setInitial(values);
            setInitialHasAddress(hasAddress);
            navigate(`/clients/${c.client_id}`);
          }}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
        <Section title="Person" hint="Their identity and demographics.">
          <FieldGrid>
            {PERSON_FIELDS.map(col => (
              <Cell key={col.name} col={col}>
                <Field col={col} value={values[col.name]}
                  initialFkLabel={initialFkLabel(existing?.client, col.name)}
                  error={errors[col.name] ?? null}
                  onChange={v => setField(col.name, v)} />
              </Cell>
            ))}
          </FieldGrid>
        </Section>

        <Section title="Contact info" hint="How to reach this client.">
          <FieldGrid>
            {CONTACT_FIELDS.map(col => (
              <Cell key={col.name} col={col}>
                <Field col={col} value={values[col.name]}
                  error={errors[col.name] ?? null}
                  onChange={v => setField(col.name, v)} />
              </Cell>
            ))}
          </FieldGrid>
        </Section>

        <Section
          title="Address"
          hint={hasAddress ? 'Where the client lives.' : 'No address on file.'}
          actions={hasAddress
            ? <button type="button" onClick={handleRemoveAddress} className="text-xs text-terracotta hover:text-terracotta-deep">Remove address</button>
            : <button type="button" onClick={() => setHasAddress(true)} className="text-xs text-terracotta hover:text-terracotta-deep">+ Add address</button>
          }
        >
          {hasAddress && (
            <FieldGrid>
              {ADDRESS_FIELDS.map(col => (
                <Cell key={col.name} col={col}>
                  <Field col={col} value={values[col.name]}
                    initialFkLabel={initialAddressFkLabel(existing?.client, col.name)}
                    error={errors[col.name] ?? null}
                    onChange={v => setField(col.name, v)} />
                </Cell>
              ))}
            </FieldGrid>
          )}
        </Section>

        <Section title="Client details" hint="The classification and status used for matching and reports.">
          <FieldGrid>
            {CLIENT_FIELDS.map(col => (
              <Cell key={col.name} col={col}>
                <Field col={col} value={values[col.name]}
                  initialFkLabel={initialClientFkLabel(existing?.client, col.name)}
                  error={errors[col.name] ?? null}
                  onChange={v => setField(col.name, v)} />
              </Cell>
            ))}
          </FieldGrid>
        </Section>

        {/* Footer actions */}
        <div className="card flex items-center justify-between gap-3">
          <div>
            {!isNew && (
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="text-sm text-terracotta hover:text-terracotta-deep disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete this client'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDirty && !saving && <span className="text-[11px] text-ink-faint italic">Unsaved changes</span>}
            <button type="button" onClick={() => safeNavigate(isNew ? '/clients' : `/clients/${id}`)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : (isNew ? 'Create client' : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

/* =================================================================== */
/*  Sub-components                                                      */
/* =================================================================== */

function Section({
  title, hint, children, actions,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3 className="font-display font-medium text-[17px] m-0">{title}</h3>
          {hint && <div className="text-xs text-ink-faint mt-0.5">{hint}</div>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">{children}</div>;
}

function Cell({ col, children }: { col: FieldDef; children: React.ReactNode }) {
  return <div className={col.type === 'textarea' ? 'sm:col-span-2' : ''}>{children}</div>;
}

function ClientNavBar({
  isNew, prevId, nextId, isDirty, savedFlash, onNav,
}: {
  isNew: boolean;
  prevId: number | null;
  nextId: number | null;
  isDirty: boolean;
  savedFlash: boolean;
  onNav: (to: string) => void;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 flex-wrap bg-paper border border-hairline rounded-md px-3 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => onNav('/clients')}
          className="text-xs text-ink-soft hover:text-terracotta">← All clients</button>
        <span className="text-hairline-strong">•</span>
        <button type="button" disabled={isNew || !prevId}
          onClick={() => prevId && onNav(`/clients/${prevId}/edit`)}
          title={isNew ? 'Save first' : (!prevId ? 'No previous client' : 'Previous client')}
          className="text-xs text-ink-soft hover:text-terracotta disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-ink-soft">
          ← Previous
        </button>
        <button type="button" disabled={isNew || !nextId}
          onClick={() => nextId && onNav(`/clients/${nextId}/edit`)}
          title={isNew ? 'Save first' : (!nextId ? 'No next client' : 'Next client')}
          className="text-xs text-ink-soft hover:text-terracotta disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-ink-soft">
          Next →
        </button>
      </div>
      <div className="flex items-center gap-3">
        {savedFlash && (
          <span className="text-xs text-sage font-medium inline-flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Saved
          </span>
        )}
        {!isNew && (
          <button type="button" onClick={() => onNav('/clients/new')}
            className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta">
            + New client
          </button>
        )}
        {isDirty && <span className="w-2 h-2 rounded-full bg-terracotta" title="Unsaved changes" />}
      </div>
    </div>
  );
}

/* =================================================================== */
/*  Helpers                                                             */
/* =================================================================== */

function blankFormState(): Record<string, any> {
  return {
    first_name: '', middle_name: '', last_name: '',
    birth_date: '', gender_id: null, ethnicity_id: null, citizen_status_id: null,
    mobile_phone: '', home_phone: '', other_phone: '', email: '',
    address_name: '', address_type_id: 1, address: '', address2: '',
    city_id: null, county_id: null, state_id: null, postalcode: '',
    client_type_id: null, client_status_id: null, start_date: '', description: '',
  };
}

function pickFields(src: Record<string, any>, keys: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of keys) {
    let v = src[k];
    if (v === '') v = null;
    out[k] = v;
  }
  return out;
}

function dateOnly(value: any): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function isDirtyValues(a: Record<string, any>, b: Record<string, any>): boolean {
  const norm = (v: any) => (v === '' || v === undefined ? null : v);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (norm(a[k]) !== norm(b[k])) return true;
  }
  return false;
}

/** Pre-supplies the FK select with the label we already know from the
 *  server, so it doesn't render "#5" while loading the options list. */
function initialFkLabel(c: any, columnName: string): string | undefined {
  if (!c) return undefined;
  switch (columnName) {
    case 'gender_id':         return c.gender ?? undefined;
    case 'ethnicity_id':      return c.ethnicity ?? undefined;
    case 'citizen_status_id': return c.citizen_status ?? undefined;
    default: return undefined;
  }
}

function initialAddressFkLabel(c: any, columnName: string): string | undefined {
  if (!c) return undefined;
  switch (columnName) {
    case 'city_id':   return c.city ?? undefined;
    case 'county_id': return c.county ?? undefined;
    case 'state_id':  return c.state ?? undefined;
    default: return undefined;
  }
}

function initialClientFkLabel(c: any, columnName: string): string | undefined {
  if (!c) return undefined;
  switch (columnName) {
    case 'client_type_id':   return c.client_type ?? undefined;
    case 'client_status_id': return c.client_status ?? undefined;
    default: return undefined;
  }
}
