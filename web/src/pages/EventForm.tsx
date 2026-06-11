/**
 * Create + edit form for an event with attendee subform.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api.ts';
import type { ColumnMeta } from '../lib/admin.ts';
import { validateForm, type FormErrors } from '../lib/adminValidate.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { Field } from '../components/admin/Field.tsx';
import { FkCreateField, FkSelectWithCreate } from '../components/admin/FkSelectWithCreate.tsx';
import { AddressQuickCreateModal } from '../components/quickCreate/AddressQuickCreateModal.tsx';
import { CampaignQuickCreateModal } from '../components/quickCreate/CampaignQuickCreateModal.tsx';
import { ContactQuickCreateModal } from '../components/quickCreate/ContactQuickCreateModal.tsx';
import { FkSelect } from '../components/admin/FkSelect.tsx';
import { FormNavBar } from '../components/forms/FormNavBar.tsx';
import { Section, FieldGrid, Cell } from '../components/forms/FormSection.tsx';
import { SubformList, type SubformRow } from '../components/forms/SubformList.tsx';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.ts';

const CORE_FIELDS: ColumnMeta[] = [
  { name: 'event_name',    label: 'Event name',  type: 'text', required: true, isPk: false, isFk: false, maxLength: 100 },
  { name: 'event_type_id', label: 'Type',        type: 'fk',   required: true, isPk: false, isFk: true, fkTable: 'lkp_event_type' },
  { name: 'campaign_id',   label: 'Campaign',    type: 'fk',   required: false, isPk: false, isFk: true, fkTable: 'tbl_campaign',
    helpText: 'Link to a fundraising campaign so amounts roll up.' },
  { name: 'event_date',    label: 'Date',        type: 'date', required: true, isPk: false, isFk: false },
  { name: 'start_time',    label: 'Start time',  type: 'time', required: false, isPk: false, isFk: false },
  { name: 'end_time',      label: 'End time',    type: 'time', required: false, isPk: false, isFk: false },
  { name: 'address_id',    label: 'Venue',       type: 'fk',   required: false, isPk: false, isFk: true, fkTable: 'tbl_address' },
];

const ROLES_FIELDS: ColumnMeta[] = [
  { name: 'manager_facility_staff_id', label: 'Event manager', type: 'fk',
    required: false, isPk: false, isFk: true, fkTable: 'tbl_facility_staff',
    helpText: 'Staff person owning this event. Gets alerted when capacity is reached.' },
  { name: 'max_attendees', label: 'Max attendees', type: 'number',
    required: false, isPk: false, isFk: false,
    helpText: 'Blank means no limit. Pre-registered attendees are hard-blocked at this number; walk-ins can be added with override.' },
];

const CONTENT_FIELDS: ColumnMeta[] = [
  { name: 'run_of_show', label: 'Run of show', type: 'textarea',
    required: false, isPk: false, isFk: false,
    helpText: 'Minute-by-minute schedule for the event team. Prints to its own card. Free-text — paste from Google Doc if you have it.' },
  { name: 'staff_briefing', label: 'Staff briefing', type: 'textarea',
    required: false, isPk: false, isFk: false,
    helpText: 'Emergency contacts, vendor phones, evacuation plan, anything day-of staff should keep in their pocket. Prints to the staff briefing card.' },
];

const MONEY_FIELDS: ColumnMeta[] = [
  { name: 'goal_amount',   label: 'Fundraising goal ($)', type: 'money', required: false, isPk: false, isFk: false, scale: 2 },
  { name: 'amount_raised', label: 'Amount raised ($)',    type: 'money', required: false, isPk: false, isFk: false, scale: 2,
    helpText: 'Manual override. Otherwise the rollup is from attendee contributions + linked donations.' },
  { name: 'ticket_price',  label: 'Ticket price ($)',     type: 'money', required: false, isPk: false, isFk: false, scale: 2 },
];

const META_FIELDS: ColumnMeta[] = [
  { name: 'is_public',  label: 'Public event',         type: 'boolean',  required: false, isPk: false, isFk: false },
  { name: 'description', label: 'Short description',  type: 'text',     required: false, isPk: false, isFk: false, maxLength: 100 },
  { name: 'notes',       label: 'Internal notes',     type: 'textarea', required: false, isPk: false, isFk: false },
];

const ALL_FIELDS = [...CORE_FIELDS, ...ROLES_FIELDS, ...MONEY_FIELDS, ...CONTENT_FIELDS, ...META_FIELDS];

interface AttendeeRow extends SubformRow {
  event_attendee_id?: number | null;
  contact_id: number | null;
  rsvp_status_id: number | null;
  attended: boolean | null;
  amount_contributed: number | string | null;
  ticket_count: number;
  notes: string | null;
  table_number: string | null;
  seat_number: string | null;
  dietary_notes: string | null;
}

/** A sponsor row in the subform. Exactly one of corporate_id /
 *  contact_id must be set — `host_kind` is a UI-only discriminator
 *  that drives which picker shows. */
interface SponsorRow extends SubformRow {
  event_sponsor_id?: number | null;
  host_kind: 'corporate' | 'contact';
  corporate_id: number | null;
  contact_id: number | null;
  sponsor_level_id: number | null;
  amount_pledged: number | string | null;
  amount_paid: number | string | null;
  acknowledged: boolean;
  notes: string | null;
  donation_id?: number | null;
}

export function EventForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading, error: loadError } = useQuery<any>({
    queryKey: ['event', id],
    queryFn: () => apiGet(`/api/events/${id}`),
    enabled: !isNew,
  });

  const [values, setValues] = useState<Record<string, any>>(() => blankForm());
  const [initial, setInitial] = useState<Record<string, any>>(() => blankForm());
  const [attendees, setAttendees] = useState<AttendeeRow[]>([]);
  const [initialAttendees, setInitialAttendees] = useState<AttendeeRow[]>([]);
  const [sponsors, setSponsors] = useState<SponsorRow[]>([]);
  const [initialSponsors, setInitialSponsors] = useState<SponsorRow[]>([]);
  // UI-only host discriminator — drives which picker we show.
  // 'none' clears both FKs.
  const [hostKind, setHostKind] = useState<'none' | 'contact' | 'corporate'>('none');
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
      setAttendees([]); setInitialAttendees([]);
      setSponsors([]); setInitialSponsors([]);
      setHostKind('none');
      return;
    }
    if (!existing) return;
    const e = existing.event;
    const v: Record<string, any> = {
      event_name: e.event_name ?? '',
      event_type_id: e.event_type_id,
      campaign_id: e.campaign_id,
      event_date: dateOnly(e.event_date),
      start_time: e.start_time ?? '',
      end_time: e.end_time ?? '',
      address_id: e.address_id,
      goal_amount: e.goal_amount,
      amount_raised: e.amount_raised,
      ticket_price: e.ticket_price,
      is_public: !!e.is_public,
      description: e.description ?? '',
      notes: e.notes ?? '',
      manager_facility_staff_id: e.manager_facility_staff_id ?? null,
      host_contact_id:   e.host_contact_id   ?? null,
      host_corporate_id: e.host_corporate_id ?? null,
      max_attendees:     e.max_attendees     ?? '',
      run_of_show:       e.run_of_show       ?? '',
      staff_briefing:    e.staff_briefing    ?? '',
    };
    setValues(v); setInitial(v);
    setHostKind(
      e.host_corporate_id ? 'corporate' :
      e.host_contact_id   ? 'contact'   :
      'none'
    );
    const ats: AttendeeRow[] = (existing.attendees ?? []).map((a: any) => ({
      event_attendee_id: a.event_attendee_id,
      contact_id: a.contact_id,
      rsvp_status_id: a.rsvp_status_id ?? null,
      attended: a.attended,
      amount_contributed: a.amount_contributed,
      ticket_count: a.ticket_count ?? 1,
      notes: a.notes,
      table_number:  a.table_number  ?? null,
      seat_number:   a.seat_number   ?? null,
      dietary_notes: a.dietary_notes ?? null,
    }));
    setAttendees(ats); setInitialAttendees(ats);
    const sps: SponsorRow[] = (existing.sponsors ?? []).map((s: any) => ({
      event_sponsor_id: s.event_sponsor_id,
      host_kind: s.corporate_id ? 'corporate' : 'contact',
      corporate_id: s.corporate_id ?? null,
      contact_id:   s.contact_id   ?? null,
      sponsor_level_id: s.sponsor_level_id,
      amount_pledged: s.amount_pledged,
      amount_paid:    s.amount_paid,
      acknowledged: !!s.acknowledged,
      notes: s.notes,
      donation_id: s.donation_id ?? null,
    }));
    setSponsors(sps); setInitialSponsors(sps);
  }, [existing, isNew]);

  const { isDirty, safeNavigate } = useUnsavedChanges({
    values: { ...values, _ats: attendees, _sp: sponsors },
    initialValues: { ...initial, _ats: initialAttendees, _sp: initialSponsors },
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiPost<{ event_id: number }>('/api/events', body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setInitial(values); setInitialAttendees(attendees);
      navigate(`/events/${data.event_id}`);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut<{ event_id: number }>(`/api/events/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      setInitial(values); setInitialAttendees(attendees); setInitialSponsors(sponsors);
      setTopError(null); setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 2200);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setInitial(values); setInitialAttendees(attendees); setInitialSponsors(sponsors);
      navigate('/events');
    },
    onError: (err: any) => setTopError(err.message ?? 'Delete failed'),
  });

  if (isLoading) return <Loading />;
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
    for (const a of attendees) {
      if (!a.contact_id) { errs._attendees = 'Every attendee row needs a person.'; break; }
    }
    // Soft client-side capacity hint. Server does the authoritative
    // hard block — this just surfaces the issue earlier.
    const cap = values.max_attendees === '' || values.max_attendees == null ? null : Number(values.max_attendees);
    if (cap != null && attendees.length > cap) {
      errs._attendees = `Capped at ${cap} attendees but the list has ${attendees.length}. Increase Max attendees or remove rows.`;
    }
    for (const s of sponsors) {
      if (!s.sponsor_level_id) { errs._sponsors = 'Every sponsor row needs a level.'; break; }
      if (s.host_kind === 'corporate' && !s.corporate_id) { errs._sponsors = 'Pick the corporate org for each sponsor row.'; break; }
      if (s.host_kind === 'contact'   && !s.contact_id)   { errs._sponsors = 'Pick the contact for each sponsor row.'; break; }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setTopError('Please fix the highlighted fields.');
      const first = Object.keys(errs).filter(k => !k.startsWith('_'))[0];
      if (first) {
        const el = document.getElementById(`field-${first}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setTopError(null);

    const body = {
      event_name: values.event_name,
      event_type_id: Number(values.event_type_id),
      event_date: values.event_date,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      address_id: values.address_id ? Number(values.address_id) : null,
      campaign_id: values.campaign_id ? Number(values.campaign_id) : null,
      goal_amount: values.goal_amount === '' || values.goal_amount == null ? null : Number(values.goal_amount),
      amount_raised: values.amount_raised === '' || values.amount_raised == null ? null : Number(values.amount_raised),
      ticket_price: values.ticket_price === '' || values.ticket_price == null ? null : Number(values.ticket_price),
      is_public: !!values.is_public,
      notes: values.notes || null,
      description: values.description || null,
      manager_facility_staff_id: values.manager_facility_staff_id ? Number(values.manager_facility_staff_id) : null,
      // Host is XOR — only the kind that's selected is sent; the
      // other column is explicitly null. 'none' clears both.
      host_contact_id:   hostKind === 'contact'   ? (values.host_contact_id   ? Number(values.host_contact_id)   : null) : null,
      host_corporate_id: hostKind === 'corporate' ? (values.host_corporate_id ? Number(values.host_corporate_id) : null) : null,
      max_attendees: cap,
      run_of_show:    values.run_of_show    || null,
      staff_briefing: values.staff_briefing || null,
      attendees: attendees.map(a => ({
        event_attendee_id: a.event_attendee_id ?? null,
        contact_id: Number(a.contact_id),
        rsvp_status_id: a.rsvp_status_id ?? null,
        attended: a.attended,
        amount_contributed: a.amount_contributed === '' || a.amount_contributed == null ? null : Number(a.amount_contributed),
        ticket_count: a.ticket_count ?? 1,
        notes: a.notes || null,
        table_number: a.table_number || null,
        seat_number:  a.seat_number  || null,
        dietary_notes: a.dietary_notes || null,
      })),
      sponsors: sponsors.map(s => ({
        event_sponsor_id: s.event_sponsor_id ?? null,
        corporate_id: s.host_kind === 'corporate' ? (s.corporate_id ? Number(s.corporate_id) : null) : null,
        contact_id:   s.host_kind === 'contact'   ? (s.contact_id   ? Number(s.contact_id)   : null) : null,
        sponsor_level_id: Number(s.sponsor_level_id),
        amount_pledged: s.amount_pledged === '' || s.amount_pledged == null ? null : Number(s.amount_pledged),
        amount_paid:    s.amount_paid    === '' || s.amount_paid    == null ? null : Number(s.amount_paid),
        acknowledged: !!s.acknowledged,
        notes: s.notes || null,
      })),
    };
    if (isNew) createMut.mutate(body);
    else updateMut.mutate(body);
  }

  function handleDelete() {
    if (!window.confirm('Permanently delete this event and all attendee records?')) return;
    deleteMut.mutate();
  }

  const saving = createMut.isPending || updateMut.isPending;
  const title = !isNew && existing ? existing.event.event_name : 'New event';

  function renderField(col: ColumnMeta) {
    if (col.name === 'address_id') {
      return (
        <Cell key={col.name} col={col}>
          <FkCreateField
            label={col.label} required={col.required} helpText={col.helpText}
            error={errors[col.name] ?? null}
            fkTable="tbl_address"
            value={values.address_id ?? null}
            onChange={v => setField('address_id', v)}
            newButtonLabel="+ New venue"
            renderModal={ctx => <AddressQuickCreateModal {...ctx} />}
          />
        </Cell>
      );
    }
    if (col.name === 'campaign_id') {
      return (
        <Cell key={col.name} col={col}>
          <FkCreateField
            label={col.label} required={col.required} helpText={col.helpText}
            error={errors[col.name] ?? null}
            fkTable="tbl_campaign"
            value={values.campaign_id ?? null}
            onChange={v => setField('campaign_id', v)}
            newButtonLabel="+ New campaign"
            renderModal={ctx => <CampaignQuickCreateModal {...ctx} />}
          />
        </Cell>
      );
    }
    return (
      <Cell key={col.name} col={col}>
        <Field
          col={col} value={values[col.name]}
          initialFkLabel={initialFkLabel(existing?.event, col.name)}
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
        emphasis={isNew ? 'event' : undefined}
        subtitle={isNew ? 'Schedule a fundraiser, awareness event, or volunteer day.' : `Editing event #${id}.`}
      />

      <FormNavBar
        listLabel="events" singularLabel="event" basePath="/events"
        isNew={isNew} prevId={existing?.prevId ?? null} nextId={existing?.nextId ?? null}
        isDirty={isDirty} savedFlash={savedFlash} onNav={safeNavigate}
      />

      {topError && <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
        <Section title="Event" hint="The basics.">
          <FieldGrid>{CORE_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Roles & capacity">
          <FieldGrid>{ROLES_FIELDS.map(renderField)}</FieldGrid>
          {/* Host is split into two FKs (contact OR corporate); the UI
              shows a radio + one picker, hiding the other. */}
          <div className="mt-3">
            <label className="field-label">Host</label>
            <div className="flex items-center gap-3 mb-2 text-xs">
              {(['none', 'contact', 'corporate'] as const).map(k => (
                <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="host_kind"
                    checked={hostKind === k}
                    onChange={() => setHostKind(k)}
                  />
                  {k === 'none' ? 'None' : k === 'contact' ? 'Person' : 'Corporate'}
                </label>
              ))}
            </div>
            {hostKind === 'contact' && (
              <FkSelect
                fkTable="tbl_contact"
                value={values.host_contact_id ?? null}
                onChange={v => setField('host_contact_id', v)}
              />
            )}
            {hostKind === 'corporate' && (
              <FkSelect
                fkTable="tbl_corporate"
                value={values.host_corporate_id ?? null}
                onChange={v => setField('host_corporate_id', v)}
              />
            )}
            <p className="text-[11px] text-ink-faint mt-1">
              Person hosts come from any contact (staff, donor, board member). Corporate hosts come from companies / orgs underwriting the event.
            </p>
          </div>
        </Section>

        <Section title="Money" hint="Goal, ticket price, total raised (rollup or override).">
          <FieldGrid>{MONEY_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Schedule & briefing" hint="Free-text cards that print to their own pages for the event team.">
          <FieldGrid>{CONTENT_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Description & visibility">
          <FieldGrid>{META_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section
          title="Attendees"
          hint="Add RSVPs, contributions, seating, and check-in tracking. Each attendee's contact must have an email on file (mobile phone optional)."
          actions={errors._attendees && <span className="text-[11px] text-terracotta-deep font-medium">{errors._attendees}</span>}
        >
          <SubformList<AttendeeRow>
            rows={attendees}
            onChange={setAttendees}
            emptyHint="No attendees yet."
            addLabel="+ Add attendee"
            newRow={() => ({ contact_id: null, rsvp_status_id: null, attended: null, amount_contributed: '', ticket_count: 1, notes: '', table_number: '', seat_number: '', dietary_notes: '' })}
            headers={
              <div className="grid grid-cols-[1.5fr_120px_60px_110px_80px_60px_1fr] gap-2">
                <div>Person</div>
                <div>RSVP</div>
                <div>Tickets</div>
                <div>Contributed</div>
                <div>Table</div>
                <div>Seat</div>
                <div>Notes / dietary</div>
              </div>
            }
            renderRow={(row, update) => (
              <div className="grid grid-cols-[1.5fr_120px_60px_110px_80px_60px_1fr] gap-2 items-start">
                <FkSelectWithCreate
                  fkTable="tbl_contact"
                  value={row.contact_id}
                  required
                  onChange={v => update({ contact_id: v })}
                  newButtonLabel="+ New"
                  renderModal={ctx => <ContactQuickCreateModal {...ctx} requireEmail />}
                />
                <FkSelect
                  fkTable="lkp_rsvp_status"
                  value={row.rsvp_status_id}
                  onChange={v => update({ rsvp_status_id: v })}
                />
                <input
                  type="number" min={1}
                  className="field-input"
                  value={row.ticket_count ?? 1}
                  onChange={e => update({ ticket_count: Number(e.target.value) || 1 })}
                />
                <input
                  type="number" step="0.01" min="0"
                  className="field-input"
                  placeholder="$"
                  value={row.amount_contributed ?? ''}
                  onChange={e => update({ amount_contributed: e.target.value === '' ? '' : Number(e.target.value) })}
                />
                <input
                  type="text"
                  className="field-input"
                  placeholder="—"
                  value={row.table_number ?? ''}
                  onChange={e => update({ table_number: e.target.value })}
                />
                <input
                  type="text"
                  className="field-input"
                  placeholder="—"
                  value={row.seat_number ?? ''}
                  onChange={e => update({ seat_number: e.target.value })}
                />
                <input
                  type="text"
                  className="field-input"
                  placeholder="dietary, +1, etc."
                  value={(row.notes ?? '') || (row.dietary_notes ?? '')}
                  onChange={e => update({ notes: e.target.value })}
                />
              </div>
            )}
          />
        </Section>

        <Section
          title="Corporate sponsors"
          hint="Recognize organizations (or individuals) underwriting the event. Each entry can be promoted to a real donation from the event detail page."
          actions={errors._sponsors && <span className="text-[11px] text-terracotta-deep font-medium">{errors._sponsors}</span>}
        >
          <SubformList<SponsorRow>
            rows={sponsors}
            onChange={setSponsors}
            emptyHint="No sponsors yet."
            addLabel="+ Add sponsor"
            newRow={() => ({
              host_kind: 'corporate',
              corporate_id: null, contact_id: null,
              sponsor_level_id: null,
              amount_pledged: '', amount_paid: '',
              acknowledged: false, notes: '',
            })}
            headers={
              <div className="grid grid-cols-[100px_1.4fr_120px_100px_100px_70px_1fr] gap-2">
                <div>Kind</div>
                <div>Sponsor</div>
                <div>Level</div>
                <div>Pledged</div>
                <div>Paid</div>
                <div>Ack'd</div>
                <div>Notes</div>
              </div>
            }
            renderRow={(row, update) => (
              <div className="grid grid-cols-[100px_1.4fr_120px_100px_100px_70px_1fr] gap-2 items-start">
                <select
                  className="field-input"
                  value={row.host_kind}
                  onChange={e => update({
                    host_kind: e.target.value as 'corporate' | 'contact',
                    corporate_id: null, contact_id: null,
                  })}
                >
                  <option value="corporate">Corporate</option>
                  <option value="contact">Person</option>
                </select>
                {row.host_kind === 'corporate' ? (
                  <FkSelect
                    fkTable="tbl_corporate"
                    value={row.corporate_id}
                    onChange={v => update({ corporate_id: v })}
                    required
                  />
                ) : (
                  <FkSelect
                    fkTable="tbl_contact"
                    value={row.contact_id}
                    onChange={v => update({ contact_id: v })}
                    required
                  />
                )}
                <FkSelect
                  fkTable="lkp_sponsor_level"
                  value={row.sponsor_level_id}
                  onChange={v => update({ sponsor_level_id: v })}
                  required
                />
                <input
                  type="number" step="0.01" min="0"
                  className="field-input"
                  placeholder="$"
                  value={row.amount_pledged ?? ''}
                  onChange={e => update({ amount_pledged: e.target.value === '' ? '' : Number(e.target.value) })}
                />
                <input
                  type="number" step="0.01" min="0"
                  className="field-input"
                  placeholder="$"
                  value={row.amount_paid ?? ''}
                  onChange={e => update({ amount_paid: e.target.value === '' ? '' : Number(e.target.value) })}
                />
                <label className="flex items-center justify-center pt-2">
                  <input
                    type="checkbox"
                    checked={row.acknowledged}
                    onChange={e => update({ acknowledged: e.target.checked })}
                    title="Thank-you sent?"
                  />
                </label>
                <input
                  type="text"
                  className="field-input"
                  placeholder="optional"
                  value={row.notes ?? ''}
                  onChange={e => update({ notes: e.target.value })}
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
                {deleteMut.isPending ? 'Deleting…' : 'Delete this event'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDirty && !saving && <span className="text-[11px] text-ink-faint italic">Unsaved changes</span>}
            <button type="button" onClick={() => safeNavigate(isNew ? '/events' : `/events/${id}`)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : (isNew ? 'Create event' : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function blankForm(): Record<string, any> {
  return {
    event_name: '', event_type_id: null, campaign_id: null,
    event_date: '', start_time: '', end_time: '',
    address_id: null, goal_amount: '', amount_raised: '', ticket_price: '',
    is_public: false, description: '', notes: '',
    manager_facility_staff_id: null,
    host_contact_id: null, host_corporate_id: null,
    max_attendees: '',
    run_of_show: '', staff_briefing: '',
  };
}

function dateOnly(value: any): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function initialFkLabel(e: any, columnName: string): string | undefined {
  if (!e) return undefined;
  switch (columnName) {
    case 'event_type_id': return e.event_type;
    case 'campaign_id':   return e.campaign_name;
    default: return undefined;
  }
}
