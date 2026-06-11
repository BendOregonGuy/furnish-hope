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

const ALL_FIELDS = [...CORE_FIELDS, ...MONEY_FIELDS, ...META_FIELDS];

interface AttendeeRow extends SubformRow {
  event_attendee_id?: number | null;
  contact_id: number | null;
  rsvp_status_id: number | null;
  attended: boolean | null;
  amount_contributed: number | string | null;
  ticket_count: number;
  notes: string | null;
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
    };
    setValues(v); setInitial(v);
    const ats: AttendeeRow[] = (existing.attendees ?? []).map((a: any) => ({
      event_attendee_id: a.event_attendee_id,
      contact_id: a.contact_id,
      rsvp_status_id: a.rsvp_status_id ?? null,
      attended: a.attended,
      amount_contributed: a.amount_contributed,
      ticket_count: a.ticket_count ?? 1,
      notes: a.notes,
    }));
    setAttendees(ats); setInitialAttendees(ats);
  }, [existing, isNew]);

  const { isDirty, safeNavigate } = useUnsavedChanges({
    values: { ...values, _ats: attendees },
    initialValues: { ...initial, _ats: initialAttendees },
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
      setInitial(values); setInitialAttendees(attendees);
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
      setInitial(values); setInitialAttendees(attendees);
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
      attendees: attendees.map(a => ({
        event_attendee_id: a.event_attendee_id ?? null,
        contact_id: Number(a.contact_id),
        rsvp_status_id: a.rsvp_status_id ?? null,
        attended: a.attended,
        amount_contributed: a.amount_contributed === '' || a.amount_contributed == null ? null : Number(a.amount_contributed),
        ticket_count: a.ticket_count ?? 1,
        notes: a.notes || null,
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

        <Section title="Money" hint="Goal, ticket price, total raised (rollup or override).">
          <FieldGrid>{MONEY_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Description & visibility">
          <FieldGrid>{META_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section
          title="Attendees"
          hint="Add RSVPs, contributions, and check-in tracking. Each attendee's contact must have an email on file (mobile phone optional)."
          actions={errors._attendees && <span className="text-[11px] text-terracotta-deep font-medium">{errors._attendees}</span>}
        >
          <SubformList<AttendeeRow>
            rows={attendees}
            onChange={setAttendees}
            emptyHint="No attendees yet."
            addLabel="+ Add attendee"
            newRow={() => ({ contact_id: null, rsvp_status_id: null, attended: null, amount_contributed: '', ticket_count: 1, notes: '' })}
            headers={
              <div className="grid grid-cols-[1.6fr_140px_80px_140px_1fr] gap-3">
                <div>Person</div>
                <div>RSVP</div>
                <div>Tickets</div>
                <div>Contributed</div>
                <div>Notes</div>
              </div>
            }
            renderRow={(row, update) => (
              <div className="grid grid-cols-[1.6fr_140px_80px_140px_1fr] gap-3 items-start">
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
