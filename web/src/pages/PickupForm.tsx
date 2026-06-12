/**
 * Create + edit form for a Donation Pickup.
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
import { DonorQuickCreateModal } from '../components/donor/DonorQuickCreateModal.tsx';
import { AddressQuickCreateModal } from '../components/quickCreate/AddressQuickCreateModal.tsx';
import { VehicleQuickCreateModal } from '../components/quickCreate/VehicleQuickCreateModal.tsx';
import { FacilityStaffQuickCreateModal } from '../components/quickCreate/FacilityStaffQuickCreateModal.tsx';
import { FormNavBar } from '../components/forms/FormNavBar.tsx';
import { Section, FieldGrid, Cell } from '../components/forms/FormSection.tsx';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.ts';

const DONOR_FIELDS: ColumnMeta[] = [
  { name: 'donor_id',          label: 'Donor',           type: 'fk', required: true,  isPk: false, isFk: true, fkTable: 'tbl_donor' },
  { name: 'pickup_address_id', label: 'Pickup address',  type: 'fk', required: true,  isPk: false, isFk: true, fkTable: 'tbl_address', helpText: 'Where to pick up — usually the donor home.' },
];

const SCHEDULE_FIELDS: ColumnMeta[] = [
  { name: 'scheduled_date',    label: 'Date',            type: 'date', required: true,  isPk: false, isFk: false },
  { name: 'pickup_status_id',  label: 'Status',          type: 'fk',   required: true,  isPk: false, isFk: true, fkTable: 'lkp_pickup_status' },
  { name: 'time_window_start', label: 'Window start',    type: 'time', required: false, isPk: false, isFk: false },
  { name: 'time_window_end',   label: 'Window end',      type: 'time', required: false, isPk: false, isFk: false },
];

const CREW_FIELDS: ColumnMeta[] = [
  { name: 'assigned_lead_facility_staff_id', label: 'Crew lead', type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'tbl_facility_staff' },
  { name: 'assigned_vehicle_id',             label: 'Vehicle',   type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'tbl_vehicle' },
];

const NOTES_FIELDS: ColumnMeta[] = [
  { name: 'access_notes', label: 'Access notes', type: 'textarea', required: false, isPk: false, isFk: false, helpText: 'Gate codes, stairs, parking — anything the crew needs to know.' },
];

const ALL_FIELDS = [...DONOR_FIELDS, ...SCHEDULE_FIELDS, ...CREW_FIELDS, ...NOTES_FIELDS];

interface PickupDetailResponse {
  pickup: any;
  prevId: number | null;
  nextId: number | null;
}

export function PickupForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading: loadingExisting, error: loadError } = useQuery<PickupDetailResponse>({
    queryKey: ['pickup', id],
    queryFn: () => apiGet(`/api/pickups/${id}`),
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
      blank.scheduled_date = todayIso();
      setValues(blank); setInitial(blank);
      return;
    }
    if (!existing) return;
    const p = existing.pickup;
    const v: Record<string, any> = {
      donor_id:                        p.donor_id,
      pickup_address_id:               p.pickup_address_id,
      pickup_status_id:                p.pickup_status_id,
      scheduled_date:                  dateOnly(p.scheduled_date),
      time_window_start:               p.time_window_start ?? '',
      time_window_end:                 p.time_window_end ?? '',
      assigned_vehicle_id:             p.assigned_vehicle_id,
      assigned_lead_facility_staff_id: p.assigned_lead_facility_staff_id,
      access_notes:                    p.access_notes ?? '',
    };
    setValues(v); setInitial(v);
  }, [existing, isNew]);

  // Auto-fill pickup_address_id with the donor's primary address when a
  // donor is picked — but only if the address is still empty, so we
  // never clobber an intentional override.
  useEffect(() => {
    if (!values.donor_id) return;
    if (values.pickup_address_id) return;
    let cancelled = false;
    apiGet<{ donor: { address_id: number | null } }>(`/api/donors/${values.donor_id}`)
      .then(r => {
        if (cancelled) return;
        if (r.donor?.address_id) {
          setValues(prev => prev.pickup_address_id
            ? prev                                                      // user filled it while we waited
            : { ...prev, pickup_address_id: r.donor.address_id });
        }
      })
      .catch(() => { /* ignore — leave the field for the user to fill */ });
    return () => { cancelled = true; };
  }, [values.donor_id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const { isDirty, safeNavigate } = useUnsavedChanges({ values, initialValues: initial });

  const createMut = useMutation({
    mutationFn: (body: any) => apiPost<{ pickup_id: number }>('/api/pickups', body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pickups'] });
      setInitial(values);
      navigate(`/pickups/${data.pickup_id}`);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut<{ pickup_id: number }>(`/api/pickups/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickups'] });
      queryClient.invalidateQueries({ queryKey: ['pickup', id] });
      setInitial(values);
      setTopError(null); setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 2200);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/pickups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickups'] });
      setInitial(values);
      navigate('/pickups');
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
      return;
    }
    setTopError(null);

    const body = {
      donor_id:                        Number(values.donor_id),
      pickup_address_id:               Number(values.pickup_address_id),
      pickup_status_id:                Number(values.pickup_status_id),
      scheduled_date:                  values.scheduled_date,
      time_window_start:               values.time_window_start || null,
      time_window_end:                 values.time_window_end || null,
      assigned_vehicle_id:             values.assigned_vehicle_id ? Number(values.assigned_vehicle_id) : null,
      assigned_lead_facility_staff_id: values.assigned_lead_facility_staff_id ? Number(values.assigned_lead_facility_staff_id) : null,
      access_notes:                    values.access_notes || null,
    };
    if (isNew) createMut.mutate(body);
    else updateMut.mutate(body);
  }

  function handleDelete() {
    if (!window.confirm('Permanently delete this pickup? This cannot be undone.')) return;
    deleteMut.mutate();
  }

  const saving = createMut.isPending || updateMut.isPending;
  const title = !isNew && existing?.pickup ? `Pickup from ${existing.pickup.donor_name}` : 'New pickup';

  function renderField(col: ColumnMeta) {
    // FK fields get a "+ New" affordance so the user can create the
    // prereq inline without abandoning the half-filled pickup form.
    if (col.name === 'donor_id') {
      return (
        <Cell key={col.name} col={col}>
          <FkCreateField
            label={col.label}
            required={col.required}
            helpText={col.helpText}
            error={errors[col.name] ?? null}
            fkTable="tbl_donor"
            value={values.donor_id ?? null}
            initialLabel={existing?.pickup?.donor_name}
            onChange={v => setField('donor_id', v)}
            newButtonLabel="+ New donor"
            renderModal={ctx => <DonorQuickCreateModal {...ctx} />}
          />
        </Cell>
      );
    }
    if (col.name === 'pickup_address_id') {
      return (
        <Cell key={col.name} col={col}>
          <FkCreateField
            label={col.label}
            required={col.required}
            helpText={col.helpText}
            error={errors[col.name] ?? null}
            fkTable="tbl_address"
            value={values.pickup_address_id ?? null}
            onChange={v => setField('pickup_address_id', v)}
            newButtonLabel="+ New address"
            renderModal={ctx => <AddressQuickCreateModal {...ctx} />}
          />
        </Cell>
      );
    }
    if (col.name === 'assigned_lead_facility_staff_id') {
      return (
        <Cell key={col.name} col={col}>
          <FkCreateField
            label={col.label}
            required={col.required}
            helpText={col.helpText}
            error={errors[col.name] ?? null}
            fkTable="tbl_facility_staff"
            value={values.assigned_lead_facility_staff_id ?? null}
            onChange={v => setField('assigned_lead_facility_staff_id', v)}
            newButtonLabel="+ New staff"
            renderModal={ctx => <FacilityStaffQuickCreateModal {...ctx} />}
          />
        </Cell>
      );
    }
    if (col.name === 'assigned_vehicle_id') {
      return (
        <Cell key={col.name} col={col}>
          <FkCreateField
            label={col.label}
            required={col.required}
            helpText={col.helpText}
            error={errors[col.name] ?? null}
            fkTable="tbl_vehicle"
            value={values.assigned_vehicle_id ?? null}
            onChange={v => setField('assigned_vehicle_id', v)}
            newButtonLabel="+ New vehicle"
            renderModal={ctx => <VehicleQuickCreateModal {...ctx} />}
          />
        </Cell>
      );
    }
    return (
      <Cell key={col.name} col={col}>
        <Field
          col={col} value={values[col.name]}
          initialFkLabel={initialFkLabel(existing?.pickup, col.name)}
          error={errors[col.name] ?? null}
          onChange={v => setField(col.name, v)}
        />
      </Cell>
    );
  }

  return (
    <>
      <PageHeader
        helpSection="pickups"
        title={isNew ? 'New' : title}
        emphasis={isNew ? 'pickup' : undefined}
        subtitle={isNew ? 'Schedule a donation pickup.' : `Editing pickup #${id}.`}
      />

      <FormNavBar
        listLabel="pickups" singularLabel="pickup" basePath="/pickups"
        isNew={isNew} prevId={existing?.prevId ?? null} nextId={existing?.nextId ?? null}
        isDirty={isDirty} savedFlash={savedFlash} onNav={safeNavigate}
      />

      {topError && <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
        <Section title="Donor & address" hint="Who and where we're picking up from.">
          <FieldGrid>{DONOR_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Schedule" hint="When the crew will be there.">
          <FieldGrid>{SCHEDULE_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Crew assignment" hint="Who's going (can be filled in later).">
          <FieldGrid>{CREW_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Access notes">
          <FieldGrid>{NOTES_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <div className="card flex items-center justify-between gap-3">
          <div>
            {!isNew && (
              <button type="button" onClick={handleDelete} disabled={deleteMut.isPending}
                className="text-sm text-terracotta hover:text-terracotta-deep disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting…' : 'Delete this pickup'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDirty && !saving && <span className="text-[11px] text-ink-faint italic">Unsaved changes</span>}
            <button type="button" onClick={() => safeNavigate(isNew ? '/pickups' : `/pickups/${id}`)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : (isNew ? 'Schedule pickup' : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function blankFormState(): Record<string, any> {
  return {
    donor_id: null, pickup_address_id: null, pickup_status_id: null,
    scheduled_date: '', time_window_start: '', time_window_end: '',
    assigned_vehicle_id: null, assigned_lead_facility_staff_id: null,
    access_notes: '',
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
    case 'donor_id':                        return p.donor_name;
    case 'pickup_address_id':               return p.address ? `${p.address}${p.city ? `, ${p.city}` : ''}` : undefined;
    case 'pickup_status_id':                return p.pickup_status;
    case 'assigned_vehicle_id':             return p.vehicle_license;
    case 'assigned_lead_facility_staff_id': return p.team_lead;
    default: return undefined;
  }
}
