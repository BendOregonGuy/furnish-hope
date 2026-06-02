/**
 * Create + edit form for a Volunteer. A volunteer is contact + facility_staff
 * + volunteer_profile + a list of skills, all rolled into one form.
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
import { FkSelect } from '../components/admin/FkSelect.tsx';
import { FormNavBar } from '../components/forms/FormNavBar.tsx';
import { Section, FieldGrid, Cell } from '../components/forms/FormSection.tsx';
import { SubformList, type SubformRow } from '../components/forms/SubformList.tsx';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.ts';

const PERSON_FIELDS: ColumnMeta[] = [
  { name: 'first_name',  label: 'First name',    type: 'text', required: true,  isPk: false, isFk: false, maxLength: 50 },
  { name: 'middle_name', label: 'Middle name',   type: 'text', required: false, isPk: false, isFk: false, maxLength: 50 },
  { name: 'last_name',   label: 'Last name',     type: 'text', required: true,  isPk: false, isFk: false, maxLength: 50 },
  { name: 'birth_date',  label: 'Date of birth', type: 'date', required: false, isPk: false, isFk: false },
  { name: 'gender_id',    label: 'Gender',    type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'lkp_gender' },
  { name: 'ethnicity_id', label: 'Ethnicity', type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'lkp_ethnicity' },
];

const CONTACT_FIELDS: ColumnMeta[] = [
  { name: 'mobile_phone', label: 'Mobile phone', type: 'text', required: false, isPk: false, isFk: false, maxLength: 20 },
  { name: 'home_phone',   label: 'Home phone',   type: 'text', required: false, isPk: false, isFk: false, maxLength: 20 },
  { name: 'other_phone',  label: 'Other phone',  type: 'text', required: false, isPk: false, isFk: false, maxLength: 20 },
  { name: 'email',        label: 'Email',        type: 'text', required: false, isPk: false, isFk: false, maxLength: 100 },
];

const STAFF_FIELDS: ColumnMeta[] = [
  { name: 'corp_facility_id', label: 'Home facility', type: 'fk',   required: true,  isPk: false, isFk: true, fkTable: 'tbl_corp_facility' },
  { name: 'hire_date',        label: 'Start date',     type: 'date', required: false, isPk: false, isFk: false },
];

const PROFILE_FIELDS: ColumnMeta[] = [
  { name: 'waiver_signed',              label: 'Waiver signed',          type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'waiver_signed_date',         label: 'Waiver date',            type: 'date',    required: false, isPk: false, isFk: false },
  { name: 'waiver_version',             label: 'Waiver version',         type: 'text',    required: false, isPk: false, isFk: false, maxLength: 20 },
  { name: 'background_check_status',    label: 'Background check status', type: 'text',   required: false, isPk: false, isFk: false, maxLength: 50, helpText: 'e.g. Cleared, Pending, Expired, Denied.' },
  { name: 'background_check_expiration', label: 'BG check expires',      type: 'date',    required: false, isPk: false, isFk: false },
  { name: 'emergency_contact_name',     label: 'Emergency contact name', type: 'text',    required: false, isPk: false, isFk: false, maxLength: 100 },
  { name: 'emergency_contact_phone',    label: 'Emergency contact phone', type: 'text',   required: false, isPk: false, isFk: false, maxLength: 20 },
  { name: 't_shirt_size',               label: 'T-shirt size',           type: 'text',    required: false, isPk: false, isFk: false, maxLength: 10 },
];

const ALL_FIELDS = [...PERSON_FIELDS, ...CONTACT_FIELDS, ...STAFF_FIELDS, ...PROFILE_FIELDS];

interface SkillRow extends SubformRow {
  skill_id: number | null;
}

interface VolunteerDetailResponse {
  volunteer: any;
  skills: Array<{ skill_id: number; skill: string }>;
  hours: any[];
  totals: any;
  prevId: number | null;
  nextId: number | null;
}

export function VolunteerForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading: loadingExisting, error: loadError } = useQuery<VolunteerDetailResponse>({
    queryKey: ['volunteer', id],
    queryFn: () => apiGet(`/api/volunteers/${id}`),
    enabled: !isNew,
  });

  const [values, setValues] = useState<Record<string, any>>(() => blankFormState());
  const [initial, setInitial] = useState<Record<string, any>>(() => blankFormState());
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [initialSkills, setInitialSkills] = useState<SkillRow[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<number | null>(null);

  useEffect(() => {
    setSubmitAttempted(false); setErrors({}); setTopError(null);
    if (isNew) {
      const blank = blankFormState();
      setValues(blank); setInitial(blank);
      setSkills([]); setInitialSkills([]);
      return;
    }
    if (!existing) return;
    const v = existing.volunteer;
    const init: Record<string, any> = {
      first_name:   v.first_name ?? '',
      middle_name:  v.middle_name ?? '',
      last_name:    v.last_name ?? '',
      birth_date:   dateOnly(v.birth_date),
      gender_id:    v.gender_id,
      ethnicity_id: v.ethnicity_id,
      mobile_phone: v.mobile_phone ?? '',
      home_phone:   v.home_phone ?? '',
      other_phone:  v.other_phone ?? '',
      email:        v.email ?? '',
      corp_facility_id: v.corp_facility_id,
      hire_date:    dateOnly(v.hire_date),
      waiver_signed: !!v.waiver_signed,
      waiver_signed_date: dateOnly(v.waiver_signed_date),
      waiver_version: v.waiver_version ?? '',
      background_check_status: v.background_check_status ?? '',
      background_check_expiration: dateOnly(v.background_check_expiration),
      emergency_contact_name: v.emergency_contact_name ?? '',
      emergency_contact_phone: v.emergency_contact_phone ?? '',
      t_shirt_size: v.t_shirt_size ?? '',
    };
    const sk: SkillRow[] = existing.skills.map(s => ({ skill_id: s.skill_id }));
    setValues(init); setInitial(init);
    setSkills(sk); setInitialSkills(sk);
  }, [existing, isNew]);

  const { isDirty, safeNavigate } = useUnsavedChanges({
    values: { ...values, _skills: skills },
    initialValues: { ...initial, _skills: initialSkills },
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiPost<{ facility_staff_id: number }>('/api/volunteers', body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      setInitial(values); setInitialSkills(skills);
      navigate(`/volunteers/${data.facility_staff_id}`);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut<{ facility_staff_id: number }>(`/api/volunteers/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      queryClient.invalidateQueries({ queryKey: ['volunteer', id] });
      setInitial(values); setInitialSkills(skills);
      setTopError(null); setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 2200);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/volunteers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      setInitial(values); setInitialSkills(skills);
      navigate('/volunteers');
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

    const body = {
      contact: {
        first_name:   values.first_name,
        middle_name:  values.middle_name || null,
        last_name:    values.last_name,
        birth_date:   values.birth_date || null,
        gender_id:    values.gender_id ? Number(values.gender_id) : null,
        ethnicity_id: values.ethnicity_id ? Number(values.ethnicity_id) : null,
        mobile_phone: values.mobile_phone || null,
        home_phone:   values.home_phone || null,
        other_phone:  values.other_phone || null,
        email:        values.email || null,
      },
      staff: {
        corp_facility_id: Number(values.corp_facility_id),
        hire_date:        values.hire_date || null,
      },
      profile: {
        waiver_signed:               !!values.waiver_signed,
        waiver_signed_date:          values.waiver_signed_date || null,
        waiver_version:              values.waiver_version || null,
        background_check_status:     values.background_check_status || null,
        background_check_expiration: values.background_check_expiration || null,
        emergency_contact_name:      values.emergency_contact_name || null,
        emergency_contact_phone:     values.emergency_contact_phone || null,
        t_shirt_size:                values.t_shirt_size || null,
      },
      skill_ids: skills.map(s => Number(s.skill_id)).filter(Boolean),
    };

    if (isNew) createMut.mutate(body);
    else updateMut.mutate(body);
  }

  function handleDelete() {
    if (!window.confirm('Permanently delete this volunteer? Their hours log and any deliveries they helped on will block deletion. This cannot be undone.')) return;
    deleteMut.mutate();
  }

  const saving = createMut.isPending || updateMut.isPending;
  const fullName = `${values.first_name} ${values.last_name}`.trim();

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
        <Field
          col={col} value={values[col.name]}
          initialFkLabel={initialFkLabel(existing?.volunteer, col.name)}
          error={errors[col.name] ?? null}
          onChange={v => setField(col.name, v)}
        />
      </Cell>
    );
  }

  return (
    <>
      <PageHeader
        title={isNew ? 'New' : (fullName || 'Edit volunteer')}
        emphasis={isNew ? 'volunteer' : undefined}
        subtitle={isNew ? 'Add a new volunteer.' : `Editing volunteer #${id}.`}
      />

      <FormNavBar
        listLabel="volunteers" singularLabel="volunteer" basePath="/volunteers"
        isNew={isNew} prevId={existing?.prevId ?? null} nextId={existing?.nextId ?? null}
        isDirty={isDirty} savedFlash={savedFlash} onNav={safeNavigate}
      />

      {topError && <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
        <Section title="Person" hint="Identity and demographics.">
          <FieldGrid>{PERSON_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Contact info" hint="How to reach them.">
          <FieldGrid>{CONTACT_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Volunteer assignment" hint="Where they work and when they joined.">
          <FieldGrid>{STAFF_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Onboarding" hint="Waiver, background check, emergency contact, t-shirt.">
          <FieldGrid>{PROFILE_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Skills" hint="Pick any that apply.">
          <SubformList<SkillRow>
            rows={skills}
            onChange={setSkills}
            emptyHint="No skills tagged yet."
            addLabel="+ Add skill"
            newRow={() => ({ skill_id: null })}
            renderRow={(row, update) => (
              <FkSelect
                fkTable="lkp_skill"
                value={row.skill_id}
                required
                onChange={v => update({ skill_id: v })}
              />
            )}
          />
        </Section>

        <div className="card flex items-center justify-between gap-3">
          <div>
            {!isNew && (
              <button type="button" onClick={handleDelete} disabled={deleteMut.isPending}
                className="text-sm text-terracotta hover:text-terracotta-deep disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting…' : 'Delete this volunteer'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDirty && !saving && <span className="text-[11px] text-ink-faint italic">Unsaved changes</span>}
            <button type="button" onClick={() => safeNavigate(isNew ? '/volunteers' : `/volunteers/${id}`)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : (isNew ? 'Create volunteer' : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function blankFormState(): Record<string, any> {
  return {
    first_name: '', middle_name: '', last_name: '', birth_date: '',
    gender_id: null, ethnicity_id: null,
    mobile_phone: '', home_phone: '', other_phone: '', email: '',
    corp_facility_id: null, hire_date: '',
    waiver_signed: false, waiver_signed_date: '', waiver_version: '',
    background_check_status: '', background_check_expiration: '',
    emergency_contact_name: '', emergency_contact_phone: '', t_shirt_size: '',
  };
}

function dateOnly(value: any): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function initialFkLabel(v: any, columnName: string): string | undefined {
  if (!v) return undefined;
  switch (columnName) {
    case 'gender_id':         return v.gender ?? undefined;
    case 'ethnicity_id':      return v.ethnicity ?? undefined;
    case 'corp_facility_id':  return v.facility_name ?? undefined;
    default: return undefined;
  }
}
