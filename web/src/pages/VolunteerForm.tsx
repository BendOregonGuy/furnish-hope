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
  { name: 'is_volunteer',     label: 'Volunteer? (unchecked = paid staff)', type: 'boolean', required: false, isPk: false, isFk: false, helpText: 'Volunteers see the availability / activity / lift sections below; paid staff see only the basic profile.' },
  { name: 'corp_facility_id', label: 'Home facility', type: 'fk',   required: true,  isPk: false, isFk: true, fkTable: 'tbl_corp_facility' },
  { name: 'hire_date',        label: 'Start date',     type: 'date', required: false, isPk: false, isFk: false },
  { name: 'background_check_status_id',  label: 'Background check status', type: 'fk',   required: false, isPk: false, isFk: true, fkTable: 'lkp_background_check_status', helpText: 'Applies to both paid staff and volunteers.' },
  { name: 'background_check_expiration', label: 'BG check expires',       type: 'date', required: false, isPk: false, isFk: false },
];

// Volunteer-only onboarding. Background check fields moved to the
// staff section so paid staff can track them too.
const PROFILE_FIELDS: ColumnMeta[] = [
  { name: 'waiver_signed',              label: 'Waiver signed',          type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'waiver_signed_date',         label: 'Waiver date',            type: 'date',    required: false, isPk: false, isFk: false },
  { name: 'waiver_version',             label: 'Waiver version',         type: 'text',    required: false, isPk: false, isFk: false, maxLength: 20 },
  { name: 'emergency_contact_name',     label: 'Emergency contact name', type: 'text',    required: false, isPk: false, isFk: false, maxLength: 100 },
  { name: 'emergency_contact_phone',    label: 'Emergency contact phone', type: 'text',   required: false, isPk: false, isFk: false, maxLength: 20 },
  { name: 't_shirt_size',               label: 'T-shirt size',           type: 'text',    required: false, isPk: false, isFk: false, maxLength: 10 },
];

// Originally captured by the public signup form. Surfaced here so staff
// can edit and so the shift signup picker has data to match on.
const SCHEDULE_FIELDS: ColumnMeta[] = [
  { name: 'frequency', label: 'Frequency', type: 'text', required: false, isPk: false, isFk: false, enumValues: ['one_time', 'recurring', 'on_call'], helpText: 'How often they expect to volunteer.' },
  { name: 'start_date', label: 'Available from', type: 'date', required: false, isPk: false, isFk: false },
  { name: 'end_date',   label: 'Available until', type: 'date', required: false, isPk: false, isFk: false },
];
const AVAILABILITY_DAY_FIELDS: ColumnMeta[] = [
  { name: 'avail_mon', label: 'Monday',    type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'avail_tue', label: 'Tuesday',   type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'avail_wed', label: 'Wednesday', type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'avail_thu', label: 'Thursday',  type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'avail_fri', label: 'Friday',    type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'avail_sat', label: 'Saturday',  type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'avail_sun', label: 'Sunday',    type: 'boolean', required: false, isPk: false, isFk: false },
];
const AVAILABILITY_TIME_FIELDS: ColumnMeta[] = [
  { name: 'time_morning',   label: 'Mornings',   type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'time_afternoon', label: 'Afternoons', type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'time_evening',   label: 'Evenings',   type: 'boolean', required: false, isPk: false, isFk: false },
];
const ACTIVITY_FIELDS: ColumnMeta[] = [
  { name: 'act_pickups',     label: 'Pickups',           type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'act_deliveries',  label: 'Deliveries',        type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'act_warehouse',   label: 'Warehouse',         type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'act_events',      label: 'Events / outreach', type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'act_admin',       label: 'Administrative',    type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'act_photography', label: 'Photography',       type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'act_trades',      label: 'Skilled trades',    type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'act_anywhere',    label: 'Anywhere needed',   type: 'boolean', required: false, isPk: false, isFk: false, helpText: 'Treats any shift type as a match in the picker.' },
];
const PHYSICAL_FIELDS: ColumnMeta[] = [
  { name: 'can_lift', label: 'Lifting capacity', type: 'text', required: false, isPk: false, isFk: false, enumValues: ['under_25', '25_50', '50_plus', 'cannot'], helpText: 'Pickup and delivery shifts default to filtering by 25-50 lbs and up.' },
  { name: 'has_drivers_license', label: 'Has driver\'s license', type: 'boolean', required: false, isPk: false, isFk: false },
  { name: 'has_vehicle',         label: 'Has own vehicle',       type: 'boolean', required: false, isPk: false, isFk: false },
];
const NARRATIVE_FIELDS: ColumnMeta[] = [
  { name: 'special_skills',       label: 'Special skills (free text)', type: 'textarea', required: false, isPk: false, isFk: false },
  { name: 'why_interested',       label: 'Why interested',             type: 'textarea', required: false, isPk: false, isFk: false },
  { name: 'heard_from_id',        label: 'How they heard about us',    type: 'fk',       required: false, isPk: false, isFk: true,  fkTable: 'lkp_howtheyfoundus' },
  { name: 'needs_verified_hours', label: 'Needs verified hours',       type: 'boolean',  required: false, isPk: false, isFk: false, helpText: 'For school / community-service credit.' },
  { name: 'agreed_to_emails',     label: 'Opted in to emails',         type: 'boolean',  required: false, isPk: false, isFk: false },
];

const ALL_FIELDS = [
  ...PERSON_FIELDS, ...CONTACT_FIELDS, ...STAFF_FIELDS, ...PROFILE_FIELDS,
  ...SCHEDULE_FIELDS, ...AVAILABILITY_DAY_FIELDS, ...AVAILABILITY_TIME_FIELDS,
  ...ACTIVITY_FIELDS, ...PHYSICAL_FIELDS, ...NARRATIVE_FIELDS,
];

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
      is_volunteer: v.is_volunteer ?? true,
      corp_facility_id: v.corp_facility_id,
      hire_date:    dateOnly(v.hire_date),
      background_check_status_id:  v.background_check_status_id ?? null,
      background_check_expiration: dateOnly(v.background_check_expiration),
      waiver_signed: !!v.waiver_signed,
      waiver_signed_date: dateOnly(v.waiver_signed_date),
      waiver_version: v.waiver_version ?? '',
      emergency_contact_name: v.emergency_contact_name ?? '',
      emergency_contact_phone: v.emergency_contact_phone ?? '',
      t_shirt_size: v.t_shirt_size ?? '',
      frequency: v.frequency ?? null,
      start_date: dateOnly(v.start_date),
      end_date:   dateOnly(v.end_date),
      avail_mon: !!v.avail_mon, avail_tue: !!v.avail_tue, avail_wed: !!v.avail_wed,
      avail_thu: !!v.avail_thu, avail_fri: !!v.avail_fri, avail_sat: !!v.avail_sat, avail_sun: !!v.avail_sun,
      time_morning:   !!v.time_morning,
      time_afternoon: !!v.time_afternoon,
      time_evening:   !!v.time_evening,
      act_pickups:     !!v.act_pickups,
      act_deliveries:  !!v.act_deliveries,
      act_warehouse:   !!v.act_warehouse,
      act_events:      !!v.act_events,
      act_admin:       !!v.act_admin,
      act_photography: !!v.act_photography,
      act_trades:      !!v.act_trades,
      act_anywhere:    !!v.act_anywhere,
      can_lift: v.can_lift ?? null,
      has_drivers_license: !!v.has_drivers_license,
      has_vehicle:         !!v.has_vehicle,
      special_skills:       v.special_skills ?? '',
      heard_from_id:        v.heard_from_id ?? null,
      why_interested:       v.why_interested ?? '',
      needs_verified_hours: !!v.needs_verified_hours,
      agreed_to_emails:     !!v.agreed_to_emails,
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
        is_volunteer:                !!values.is_volunteer,
        corp_facility_id:            Number(values.corp_facility_id),
        hire_date:                   values.hire_date || null,
        background_check_status_id:  values.background_check_status_id ? Number(values.background_check_status_id) : null,
        background_check_expiration: values.background_check_expiration || null,
      },
      profile: {
        waiver_signed:               !!values.waiver_signed,
        waiver_signed_date:          values.waiver_signed_date || null,
        waiver_version:              values.waiver_version || null,
        emergency_contact_name:      values.emergency_contact_name || null,
        emergency_contact_phone:     values.emergency_contact_phone || null,
        t_shirt_size:                values.t_shirt_size || null,
        // Expanded profile (signup-form parity)
        frequency:                   values.frequency || null,
        start_date:                  values.start_date || null,
        end_date:                    values.end_date || null,
        avail_mon: !!values.avail_mon, avail_tue: !!values.avail_tue,
        avail_wed: !!values.avail_wed, avail_thu: !!values.avail_thu,
        avail_fri: !!values.avail_fri, avail_sat: !!values.avail_sat,
        avail_sun: !!values.avail_sun,
        time_morning:   !!values.time_morning,
        time_afternoon: !!values.time_afternoon,
        time_evening:   !!values.time_evening,
        act_pickups:     !!values.act_pickups,
        act_deliveries:  !!values.act_deliveries,
        act_warehouse:   !!values.act_warehouse,
        act_events:      !!values.act_events,
        act_admin:       !!values.act_admin,
        act_photography: !!values.act_photography,
        act_trades:      !!values.act_trades,
        act_anywhere:    !!values.act_anywhere,
        can_lift:                    values.can_lift || null,
        has_drivers_license: !!values.has_drivers_license,
        has_vehicle:         !!values.has_vehicle,
        special_skills:              values.special_skills || null,
        heard_from_id:               values.heard_from_id ? Number(values.heard_from_id) : null,
        why_interested:              values.why_interested || null,
        needs_verified_hours: !!values.needs_verified_hours,
        agreed_to_emails:     !!values.agreed_to_emails,
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
        helpSection="volunteers-manual"
        title={isNew ? 'New' : (fullName || 'Edit')}
        emphasis={isNew ? (values.is_volunteer ? 'volunteer' : 'staff member') : undefined}
        subtitle={isNew
          ? `Add a new ${values.is_volunteer ? 'volunteer' : 'paid staff member'}. Switch the "Volunteer?" checkbox to change.`
          : `Editing ${values.is_volunteer ? 'volunteer' : 'paid staff'} #${id}.`}
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

        {values.is_volunteer && (
          <>
            <Section title="Volunteer onboarding" hint="Waiver, emergency contact, t-shirt.">
              <FieldGrid>{PROFILE_FIELDS.map(renderField)}</FieldGrid>
            </Section>

            <Section title="Schedule" hint="Commitment level and availability window.">
              <FieldGrid>{SCHEDULE_FIELDS.map(renderField)}</FieldGrid>
            </Section>

            <Section title="Availability" hint="Days and times they can typically volunteer. Used to match them against shifts.">
              <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-1.5">Days of week</div>
              <FieldGrid>{AVAILABILITY_DAY_FIELDS.map(renderField)}</FieldGrid>
              <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mt-3 mb-1.5">Time of day</div>
              <FieldGrid>{AVAILABILITY_TIME_FIELDS.map(renderField)}</FieldGrid>
            </Section>

            <Section title="Activity preferences" hint="Types of work they're interested in. Drives the default volunteer list when staff signs them up for a shift.">
              <FieldGrid>{ACTIVITY_FIELDS.map(renderField)}</FieldGrid>
            </Section>

            <Section title="Physical / logistics" hint="Used to filter pickup and delivery shifts.">
              <FieldGrid>{PHYSICAL_FIELDS.map(renderField)}</FieldGrid>
            </Section>

            <Section title="Background" hint="Free-text context for recruiters; not used by the matcher.">
              <FieldGrid>{NARRATIVE_FIELDS.map(renderField)}</FieldGrid>
            </Section>
          </>
        )}

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
    is_volunteer: true,
    corp_facility_id: null, hire_date: '',
    background_check_status_id: null, background_check_expiration: '',
    waiver_signed: false, waiver_signed_date: '', waiver_version: '',
    emergency_contact_name: '', emergency_contact_phone: '', t_shirt_size: '',
    // Expanded profile (originally captured by public signup form)
    frequency: null, start_date: '', end_date: '',
    avail_mon: false, avail_tue: false, avail_wed: false,
    avail_thu: false, avail_fri: false, avail_sat: false, avail_sun: false,
    time_morning: false, time_afternoon: false, time_evening: false,
    act_pickups: false, act_deliveries: false, act_warehouse: false,
    act_events: false,  act_admin: false,       act_photography: false,
    act_trades: false,  act_anywhere: false,
    can_lift: null, has_drivers_license: false, has_vehicle: false,
    special_skills: '', heard_from_id: null, why_interested: '',
    needs_verified_hours: false, agreed_to_emails: false,
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
