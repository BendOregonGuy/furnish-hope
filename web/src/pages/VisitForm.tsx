/**
 * Create + edit form for a client visit — the scheduled session where
 * a client chooses their furniture. Modes: in-person showroom, phone,
 * Zoom, or async email.
 *
 * Supports `?client_id=...&request_id=...` query params so ClientDetail
 * (and request detail) can pre-fill the linkage when launching from
 * their respective pages.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api.ts';
import type { ColumnMeta } from '../lib/admin.ts';
import { validateForm, type FormErrors } from '../lib/adminValidate.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { Field } from '../components/admin/Field.tsx';
import { FkSelect } from '../components/admin/FkSelect.tsx';
import { FormNavBar } from '../components/forms/FormNavBar.tsx';
import { Section, FieldGrid, Cell } from '../components/forms/FormSection.tsx';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.ts';

const FIELDS: ColumnMeta[] = [
  { name: 'client_id',              label: 'Client',          type: 'fk',   required: true,  isPk: false, isFk: true, fkTable: 'tbl_client' },
  { name: 'visit_date',             label: 'Date',            type: 'date', required: true,  isPk: false, isFk: false },
  { name: 'start_time',             label: 'Start time',      type: 'time', required: false, isPk: false, isFk: false },
  { name: 'end_time',               label: 'End time',        type: 'time', required: false, isPk: false, isFk: false },
  { name: 'visit_mode_id',          label: 'Mode',            type: 'fk',   required: true,  isPk: false, isFk: true, fkTable: 'lkp_visit_mode', helpText: 'In-person, phone, Zoom, or email — soft requirement before a delivery.' },
  { name: 'visit_status_id',        label: 'Status',          type: 'fk',   required: true,  isPk: false, isFk: true, fkTable: 'lkp_visit_status' },
  { name: 'host_facility_staff_id', label: 'Host (staff)',    type: 'fk',   required: false, isPk: false, isFk: true, fkTable: 'tbl_facility_staff', helpText: 'Who is hosting the showroom tour or the call.' },
  { name: 'corp_facility_id',       label: 'Location',        type: 'fk',   required: false, isPk: false, isFk: true, fkTable: 'tbl_corp_facility', helpText: 'Showroom or warehouse where an in-person visit happens.' },
  { name: 'client_provisioning_request_id', label: 'Linked request', type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'tbl_client_provisioning_request', helpText: 'Optional — link this visit to the provisioning request it serves.' },
  { name: 'notes',                  label: 'Notes',           type: 'textarea', required: false, isPk: false, isFk: false },
];

function blankState(): Record<string, any> {
  return {
    client_id: null, visit_date: '', start_time: '', end_time: '',
    visit_mode_id: null, visit_status_id: null,
    host_facility_staff_id: null, corp_facility_id: null,
    client_provisioning_request_id: null, notes: '',
  };
}

interface VisitDetailResponse {
  visit: any;
  prevId: number | null;
  nextId: number | null;
}

export function VisitForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading: loadingExisting, error: loadError } = useQuery<VisitDetailResponse>({
    queryKey: ['visit', id],
    queryFn: () => apiGet(`/api/visits/${id}`),
    enabled: !isNew,
  });

  const [values, setValues] = useState<Record<string, any>>(() => blankState());
  const [initial, setInitial] = useState<Record<string, any>>(() => blankState());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<number | null>(null);

  // Pre-fill from query string for "Schedule visit" launches from
  // client / request pages. Only on /visits/new (isNew).
  useEffect(() => {
    if (!isNew) return;
    const clientId = searchParams.get('client_id');
    const requestId = searchParams.get('request_id');
    if (clientId || requestId) {
      setValues(prev => ({
        ...prev,
        client_id: clientId ? Number(clientId) : prev.client_id,
        client_provisioning_request_id: requestId ? Number(requestId) : prev.client_provisioning_request_id,
        visit_date: prev.visit_date || todayIso(),
      }));
    } else {
      setValues(prev => ({ ...prev, visit_date: prev.visit_date || todayIso() }));
    }
  }, [isNew, searchParams]);

  useEffect(() => {
    if (existing?.visit) {
      const v = existing.visit;
      const init = {
        client_id:                      v.client_id,
        visit_date:                     String(v.visit_date).slice(0, 10),
        start_time:                     v.start_time ?? '',
        end_time:                       v.end_time ?? '',
        visit_mode_id:                  v.visit_mode_id,
        visit_status_id:                v.visit_status_id,
        host_facility_staff_id:         v.host_facility_staff_id,
        corp_facility_id:               v.corp_facility_id,
        client_provisioning_request_id: v.client_provisioning_request_id,
        notes:                          v.notes ?? '',
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
    mutationFn: (body: any) => apiPost<{ client_visit_id: number }>('/api/visits', body),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      navigate(`/visits/${r.client_visit_id}`);
    },
    onError: (e: any) => setTopError(e.message ?? 'Save failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut(`/api/visits/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visit', id] });
      setInitial(values);
      setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 1800);
    },
    onError: (e: any) => setTopError(e.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/visits/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['visits'] }); navigate('/visits'); },
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
      client_id: Number(values.client_id),
      visit_date: values.visit_date,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      visit_mode_id: Number(values.visit_mode_id),
      visit_status_id: Number(values.visit_status_id),
      host_facility_staff_id: values.host_facility_staff_id ? Number(values.host_facility_staff_id) : null,
      corp_facility_id: values.corp_facility_id ? Number(values.corp_facility_id) : null,
      client_provisioning_request_id: values.client_provisioning_request_id ? Number(values.client_provisioning_request_id) : null,
      notes: values.notes || null,
    };
    if (isNew) createMut.mutate(body); else updateMut.mutate(body);
  }

  function handleDelete() {
    if (window.confirm('Permanently delete this visit?')) deleteMut.mutate();
  }

  if (!isNew && loadingExisting) return <Loading />;
  if (loadError) return <ErrorBox error={loadError} />;

  const saving = createMut.isPending || updateMut.isPending;
  const title = !isNew && existing?.visit ? `Visit · ${existing.visit.client_name}` : 'New visit';

  function renderField(col: ColumnMeta) {
    if (col.name === 'visit_mode_id' || col.name === 'visit_status_id') {
      return (
        <Cell key={col.name} col={col}>
          <label className="field-label">{col.label} {col.required && <span className="text-terracotta">*</span>}</label>
          <FkSelect
            fkTable={col.fkTable!}
            value={values[col.name] ?? null}
            required={col.required}
            onChange={v => setField(col.name, v)}
          />
          {col.helpText && <div className="text-[11px] text-ink-faint mt-1">{col.helpText}</div>}
          {errors[col.name] && <div className="text-[11px] text-terracotta-deep mt-1 font-medium">{errors[col.name]}</div>}
        </Cell>
      );
    }
    return (
      <Cell key={col.name} col={col}>
        <Field col={col} value={values[col.name]}
          initialFkLabel={initialFkLabel(existing?.visit, col.name)}
          error={errors[col.name] ?? null}
          onChange={v => setField(col.name, v)} />
      </Cell>
    );
  }

  return (
    <>
      <PageHeader
        helpSection="visits"
        title={isNew ? 'New' : title}
        emphasis={isNew ? 'visit' : undefined}
        subtitle={isNew ? 'Schedule a client visit to pick out furniture.' : `Editing visit #${id}.`}
      />

      <FormNavBar
        listLabel="visits" singularLabel="visit" basePath="/visits"
        isNew={isNew} prevId={existing?.prevId ?? null} nextId={existing?.nextId ?? null}
        isDirty={isDirty} savedFlash={savedFlash} onNav={safeNavigate}
      />

      {topError && <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
        <Section title="Visit" hint="Who, when, and how the client will pick their furniture.">
          <FieldGrid>{FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <div className="card flex items-center justify-between gap-3">
          <div>
            {!isNew && (
              <button type="button" onClick={handleDelete} disabled={deleteMut.isPending}
                className="text-sm text-terracotta hover:text-terracotta-deep disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting…' : 'Delete visit'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => safeNavigate(isNew ? '/visits' : `/visits/${id}`)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : (isNew ? 'Schedule visit' : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function initialFkLabel(v: any, columnName: string): string | undefined {
  if (!v) return undefined;
  switch (columnName) {
    case 'client_id':                      return v.client_name;
    case 'visit_mode_id':                  return v.visit_mode;
    case 'visit_status_id':                return v.visit_status;
    case 'host_facility_staff_id':         return v.host_name;
    case 'corp_facility_id':               return v.facility_name;
    default: return undefined;
  }
}
