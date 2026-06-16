/**
 * Create + edit form for a Delivery. Includes crew + items + vehicle as
 * subforms so the user can manage everything from one screen.
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
import { FacilityStaffQuickCreateModal } from '../components/quickCreate/FacilityStaffQuickCreateModal.tsx';
import { VehicleQuickCreateModal } from '../components/quickCreate/VehicleQuickCreateModal.tsx';
import { FkSelect } from '../components/admin/FkSelect.tsx';
import { FormNavBar } from '../components/forms/FormNavBar.tsx';
import { Section, FieldGrid, Cell } from '../components/forms/FormSection.tsx';
import { SubformList, type SubformRow } from '../components/forms/SubformList.tsx';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.ts';

const CORE_FIELDS: ColumnMeta[] = [
  { name: 'client_provisioning_request_id', label: 'Provisioning request', type: 'fk',   required: true, isPk: false, isFk: true, fkTable: 'tbl_client_provisioning_request' },
  { name: 'facility_staff_id',              label: 'Scheduled by',         type: 'fk',   required: true, isPk: false, isFk: true, fkTable: 'tbl_facility_staff' },
  { name: 'delivery_status_id',             label: 'Status',               type: 'fk',   required: true, isPk: false, isFk: true, fkTable: 'lkp_delivery_status' },
  { name: 'delivery_date',                  label: 'Date',                 type: 'date', required: true, isPk: false, isFk: false },
];

const TIME_FIELDS: ColumnMeta[] = [
  { name: 'time_arrival_earliest', label: 'Earliest arrival',  type: 'time', required: false, isPk: false, isFk: false },
  { name: 'time_arrival_latest',   label: 'Latest arrival',    type: 'time', required: false, isPk: false, isFk: false },
  { name: 'time_delivery_complete', label: 'Completed at',     type: 'time', required: false, isPk: false, isFk: false },
];

const NOTES_FIELDS: ColumnMeta[] = [
  { name: 'gate_code', label: 'Gate code', type: 'text',     required: false, isPk: false, isFk: false, maxLength: 10 },
  { name: 'notes',     label: 'Notes',     type: 'textarea', required: false, isPk: false, isFk: false },
];

const FULFILLMENT_FIELDS: ColumnMeta[] = [
  { name: 'fulfillment_method_id', label: 'Fulfillment method', type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'lkp_fulfillment_method', helpText: 'How the client receives their furniture: home delivery, walkout at the visit, or container pickup.' },
];

const VEHICLE_FIELDS: ColumnMeta[] = [
  { name: 'delivery_vehicle_type_id', label: 'Vehicle type',   type: 'fk',    required: true,  isPk: false, isFk: true, fkTable: 'lkp_delivery_vehicle_type' },
  { name: 'vehicle_id',               label: 'Company vehicle', type: 'fk',   required: false, isPk: false, isFk: true, fkTable: 'tbl_vehicle', helpText: 'Use either a company vehicle OR a rental — not both.' },
  { name: 'rental_agency_id',         label: 'Rental agency',  type: 'fk',    required: false, isPk: false, isFk: true, fkTable: 'lkp_rental_agency' },
  { name: 'mileage_start',            label: 'Mileage out',    type: 'number', required: false, isPk: false, isFk: false },
  { name: 'mileage_end',              label: 'Mileage in',     type: 'number', required: false, isPk: false, isFk: false },
  { name: 'fuel_cost',                label: 'Fuel cost ($)',  type: 'money', required: false, isPk: false, isFk: false, scale: 2 },
];

const ALL_CORE = [...CORE_FIELDS, ...TIME_FIELDS, ...NOTES_FIELDS];

interface CrewRow extends SubformRow {
  delivery_staff_id?: number | null;
  facility_staff_id: number | null;
  is_team_lead: boolean;
}
interface ItemRow extends SubformRow {
  delivery_items_id?: number | null;
  corp_facility_inventory_item_id: number | null;
}
interface VehicleState {
  delivery_vehicle_type_id: number | null;
  vehicle_id: number | null;
  rental_agency_id: number | null;
  mileage_start: number | string | null;
  mileage_end: number | string | null;
  fuel_cost: number | string | null;
}

interface ContainerRow extends SubformRow {
  client_delivery_container_id?: number | null;
  storage_location_id: number | null;
}

interface ContainerOption {
  storage_location_id: number;
  location_code: string;
  container_type: string | null;
  description: string | null;
  corp_facility_id: number | null;
  facility_name: string | null;
}

interface DeliveryDetailResponse {
  delivery: any;
  crew: any[];
  items: any[];
  receipt: any | null;
  containers: any[];
  prevId: number | null;
  nextId: number | null;
}

export function DeliveryForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading: loadingExisting, error: loadError } = useQuery<DeliveryDetailResponse>({
    queryKey: ['delivery', id],
    queryFn: () => apiGet(`/api/deliveries/${id}`),
    enabled: !isNew,
  });

  // Fulfillment methods — fetched once so we can identify the
  // "Container pickup" id (and only then show the container subform).
  const { data: fulfillmentMethods } = useQuery<Array<{ id: number; label: string }>>({
    queryKey: ['fk-options', 'lkp_fulfillment_method'],
    queryFn: () => apiGet('/api/admin/fk-options/lkp_fulfillment_method', { limit: '50' }),
  });
  const containerPickupId = fulfillmentMethods?.find(m => m.label === 'Container pickup')?.id ?? null;

  // Available containers + lockboxes for the picker — loaded only when
  // the user actually opens the container subform.
  const { data: containerOptions } = useQuery<ContainerOption[]>({
    queryKey: ['delivery-container-options'],
    queryFn: () => apiGet('/api/deliveries/container-options'),
  });

  // Default pickup deadline — admin can edit the underlying setting
  // at /admin/settings (the row is named container_pickup_default_deadline_days).
  // Reading the setting per-form would require admin scope on /api/admin/settings,
  // so we hard-code the well-known default and let admins change the DB row
  // when they want a different number to surface to staff.
  const defaultDeadlineDays = 30;

  const [values, setValues] = useState<Record<string, any>>(() => blankFormState());
  const [initial, setInitial] = useState<Record<string, any>>(() => blankFormState());
  const [crew, setCrew] = useState<CrewRow[]>([]);
  const [initialCrew, setInitialCrew] = useState<CrewRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [initialItems, setInitialItems] = useState<ItemRow[]>([]);
  const [hasVehicle, setHasVehicle] = useState(false);
  const [initialHasVehicle, setInitialHasVehicle] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleState>(blankVehicle());
  const [initialVehicle, setInitialVehicle] = useState<VehicleState>(blankVehicle());
  const [containers, setContainers] = useState<ContainerRow[]>([]);
  const [initialContainers, setInitialContainers] = useState<ContainerRow[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<number | null>(null);

  useEffect(() => {
    setSubmitAttempted(false); setErrors({}); setTopError(null);
    if (isNew) {
      const blank = blankFormState();
      blank.delivery_date = todayIso();
      setValues(blank); setInitial(blank);
      setCrew([]); setInitialCrew([]);
      setItems([]); setInitialItems([]);
      setHasVehicle(false); setInitialHasVehicle(false);
      setVehicle(blankVehicle()); setInitialVehicle(blankVehicle());
      setContainers([]); setInitialContainers([]);
      return;
    }
    if (!existing) return;
    const d = existing.delivery;
    const v: Record<string, any> = {
      client_provisioning_request_id: d.client_provisioning_request_id,
      facility_staff_id:              d.facility_staff_id,
      delivery_status_id:             d.delivery_status_id,
      delivery_date:                  dateOnly(d.delivery_date),
      time_arrival_earliest:          d.time_arrival_earliest ?? '',
      time_arrival_latest:            d.time_arrival_latest ?? '',
      time_delivery_complete:         d.time_delivery_complete ?? '',
      gate_code:                      d.gate_code ?? '',
      notes:                          d.notes ?? '',
      fulfillment_method_id:          d.fulfillment_method_id ?? null,
      pickup_deadline:                dateOnly(d.pickup_deadline),
      lock_code:                      d.lock_code ?? '',
    };
    const containerRows: ContainerRow[] = (existing.containers ?? []).map((ct: any) => ({
      client_delivery_container_id: ct.client_delivery_container_id,
      storage_location_id: ct.storage_location_id,
    }));
    const crewRows: CrewRow[] = existing.crew.map(c => ({
      delivery_staff_id: c.delivery_staff_id,
      facility_staff_id: c.facility_staff_id,
      is_team_lead: !!c.is_team_lead,
    }));
    const itemRows: ItemRow[] = existing.items.map(it => ({
      delivery_items_id: it.delivery_items_id,
      corp_facility_inventory_item_id: it.corp_facility_inventory_item_id,
    }));
    const veh: VehicleState = d.delivery_vehicle_id ? {
      delivery_vehicle_type_id: d.delivery_vehicle_type_id,
      vehicle_id: d.vehicle_id,
      rental_agency_id: d.rental_agency_id,
      mileage_start: d.mileage_start,
      mileage_end: d.mileage_end,
      fuel_cost: d.fuel_cost,
    } : blankVehicle();

    setValues(v); setInitial(v);
    setCrew(crewRows); setInitialCrew(crewRows);
    setItems(itemRows); setInitialItems(itemRows);
    const hv = !!d.delivery_vehicle_id;
    setHasVehicle(hv); setInitialHasVehicle(hv);
    setVehicle(veh); setInitialVehicle(veh);
    setContainers(containerRows); setInitialContainers(containerRows);
  }, [existing, isNew]);

  const { isDirty, safeNavigate } = useUnsavedChanges({
    values: { ...values, _crew: crew, _items: items, _veh: vehicle, _containers: containers },
    initialValues: { ...initial, _crew: initialCrew, _items: initialItems, _veh: initialVehicle, _containers: initialContainers },
    extraDirtyCheck: hasVehicle !== initialHasVehicle,
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiPost<{ delivery_id: number }>('/api/deliveries', body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      setInitial(values); setInitialCrew(crew); setInitialItems(items);
      setInitialHasVehicle(hasVehicle); setInitialVehicle(vehicle);
      setInitialContainers(containers);
      navigate(`/deliveries/${data.delivery_id}`);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut<{ delivery_id: number }>(`/api/deliveries/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery', id] });
      setInitial(values); setInitialCrew(crew); setInitialItems(items);
      setInitialHasVehicle(hasVehicle); setInitialVehicle(vehicle);
      setInitialContainers(containers);
      setTopError(null); setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 2200);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/deliveries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      setInitial(values); setInitialCrew(crew); setInitialItems(items);
      setInitialHasVehicle(hasVehicle); setInitialVehicle(vehicle);
      setInitialContainers(containers);
      navigate('/deliveries');
    },
    onError: (err: any) => setTopError(err.message ?? 'Delete failed'),
  });

  if (loadingExisting) return <Loading />;
  if (loadError) return <ErrorBox error={loadError} />;

  function setField(name: string, v: any) {
    setValues(prev => ({ ...prev, [name]: v }));
    if (submitAttempted) {
      const col = ALL_CORE.find(c => c.name === name);
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
    const errs = validateForm(ALL_CORE, values);
    // Subform validation
    for (const c of crew) {
      if (!c.facility_staff_id) { errs._crew = 'Every crew row needs a person.'; break; }
    }
    const leads = crew.filter(c => c.is_team_lead).length;
    if (leads > 1) errs._crew = 'Only one crew member can be marked Team lead.';
    for (const it of items) {
      if (!it.corp_facility_inventory_item_id) { errs._items = 'Every item row needs an inventory item.'; break; }
    }
    if (hasVehicle && !vehicle.delivery_vehicle_type_id) {
      errs._veh = 'Pick a vehicle type or remove the vehicle.';
    }
    // Container-pickup deliveries need a lock code + at least one container.
    // The fields hide for other fulfillment methods, so only check when the
    // user actually chose Container pickup.
    if (containerPickupId && values.fulfillment_method_id === containerPickupId) {
      if (!values.lock_code?.trim()) errs.lock_code = 'A lock code is required for container pickup.';
      const usableContainers = containers.filter(c => c.storage_location_id != null);
      if (usableContainers.length === 0) errs._containers = 'Assign at least one container or lockbox.';
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

    const isContainerPickup = containerPickupId != null && values.fulfillment_method_id === containerPickupId;

    const body = {
      client_provisioning_request_id: Number(values.client_provisioning_request_id),
      facility_staff_id:              Number(values.facility_staff_id),
      delivery_status_id:             Number(values.delivery_status_id),
      delivery_date:                  values.delivery_date,
      time_arrival_earliest:          values.time_arrival_earliest || null,
      time_arrival_latest:            values.time_arrival_latest || null,
      time_delivery_complete:         values.time_delivery_complete || null,
      gate_code:                      values.gate_code || null,
      notes:                          values.notes || null,
      fulfillment_method_id:          values.fulfillment_method_id ? Number(values.fulfillment_method_id) : null,
      // Only persist container-pickup data when the method actually is
      // Container pickup. Switching from Container pickup to Walkout
      // mid-edit would otherwise leave a stale lock_code on the row.
      pickup_deadline:                isContainerPickup ? (values.pickup_deadline || null) : null,
      lock_code:                      isContainerPickup ? (values.lock_code?.trim() || null) : null,
      containers: isContainerPickup
        ? containers.map(ct => ({
            client_delivery_container_id: ct.client_delivery_container_id ?? null,
            storage_location_id: ct.storage_location_id ? Number(ct.storage_location_id) : null,
          })).filter(ct => ct.storage_location_id != null)
        : [],
      crew: crew.map(c => ({
        delivery_staff_id: c.delivery_staff_id ?? null,
        facility_staff_id: Number(c.facility_staff_id),
        is_team_lead: !!c.is_team_lead,
      })),
      items: items.map(it => ({
        delivery_items_id: it.delivery_items_id ?? null,
        corp_facility_inventory_item_id: Number(it.corp_facility_inventory_item_id),
      })),
      vehicle: hasVehicle ? {
        delivery_vehicle_type_id: Number(vehicle.delivery_vehicle_type_id),
        vehicle_id: vehicle.vehicle_id ? Number(vehicle.vehicle_id) : null,
        rental_agency_id: vehicle.rental_agency_id ? Number(vehicle.rental_agency_id) : null,
        mileage_start: vehicle.mileage_start === '' || vehicle.mileage_start == null ? null : Number(vehicle.mileage_start),
        mileage_end:   vehicle.mileage_end   === '' || vehicle.mileage_end   == null ? null : Number(vehicle.mileage_end),
        fuel_cost:     vehicle.fuel_cost     === '' || vehicle.fuel_cost     == null ? null : Number(vehicle.fuel_cost),
      } : null,
    };
    if (isNew) createMut.mutate(body);
    else updateMut.mutate(body);
  }

  function handleDelete() {
    if (!window.confirm('Permanently delete this delivery, including its crew, items, vehicle, and receipt? This cannot be undone.')) return;
    deleteMut.mutate();
  }

  function setVehicleField(name: keyof VehicleState, v: any) {
    setVehicle(prev => ({ ...prev, [name]: v }));
  }

  const saving = createMut.isPending || updateMut.isPending;
  const title = !isNew && existing?.delivery ? `Delivery for ${existing.delivery.client_name}` : 'New delivery';

  function renderField(col: ColumnMeta) {
    if (col.name === 'facility_staff_id') {
      return (
        <Cell key={col.name} col={col}>
          <FkCreateField
            label={col.label}
            required={col.required}
            helpText={col.helpText}
            error={errors[col.name] ?? null}
            fkTable="tbl_facility_staff"
            value={values.facility_staff_id ?? null}
            onChange={v => setField('facility_staff_id', v)}
            newButtonLabel="+ New staff"
            renderModal={ctx => <FacilityStaffQuickCreateModal {...ctx} />}
          />
        </Cell>
      );
    }
    if (col.name === 'vehicle_id') {
      return (
        <Cell key={col.name} col={col}>
          <FkCreateField
            label={col.label}
            required={col.required}
            helpText={col.helpText}
            error={errors[col.name] ?? null}
            fkTable="tbl_vehicle"
            value={values.vehicle_id ?? null}
            onChange={v => setField('vehicle_id', v)}
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
          initialFkLabel={initialFkLabel(existing?.delivery, col.name)}
          error={errors[col.name] ?? null}
          onChange={v => setField(col.name, v)}
        />
      </Cell>
    );
  }

  return (
    <>
      <PageHeader
        helpSection="deliveries"
        title={isNew ? 'New' : title}
        emphasis={isNew ? 'delivery' : undefined}
        subtitle={isNew ? 'Schedule a delivery to a client.' : `Editing delivery #${id}.`}
      />

      <FormNavBar
        listLabel="deliveries" singularLabel="delivery" basePath="/deliveries"
        isNew={isNew} prevId={existing?.prevId ?? null} nextId={existing?.nextId ?? null}
        isDirty={isDirty} savedFlash={savedFlash} onNav={safeNavigate}
      />

      {topError && <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
        <Section title="Delivery" hint="Which request, who's scheduling, what status.">
          <FieldGrid>{CORE_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Schedule" hint="Arrival window and actual completion.">
          <FieldGrid>{TIME_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section
          title="Fulfillment"
          hint="How the client receives their furniture. For container pickup, set the lock code, deadline, and which container(s)."
        >
          <FieldGrid>{FULFILLMENT_FIELDS.map(renderField)}</FieldGrid>

          {containerPickupId && values.fulfillment_method_id === containerPickupId && (
            <div className="mt-4 space-y-4 pt-4 border-t border-hairline">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Pickup deadline</label>
                  <input
                    type="date"
                    className="field-input"
                    value={values.pickup_deadline ?? ''}
                    onChange={e => setField('pickup_deadline', e.target.value)}
                    placeholder={`Defaults to ${defaultDeadlineDays} days out`}
                  />
                  <div className="text-[11px] text-ink-faint mt-1">
                    Default is {defaultDeadlineDays} days from today. After this date, staff should follow up.
                  </div>
                  {!values.pickup_deadline && (
                    <button
                      type="button"
                      onClick={() => setField('pickup_deadline', addDays(todayIso(), defaultDeadlineDays))}
                      className="text-[11px] text-terracotta hover:text-terracotta-deep mt-1"
                    >Apply default ({defaultDeadlineDays} days)</button>
                  )}
                </div>
                <div>
                  <label className="field-label">Lock code <span className="text-terracotta">*</span></label>
                  <input
                    type="text"
                    className="field-input font-mono"
                    value={values.lock_code ?? ''}
                    onChange={e => setField('lock_code', e.target.value)}
                    placeholder="e.g. 4731"
                    maxLength={40}
                  />
                  {errors.lock_code && <div className="text-[11px] text-terracotta-deep mt-1 font-medium">{errors.lock_code}</div>}
                  <div className="text-[11px] text-ink-faint mt-1">
                    Shared across all containers on this pickup. Don't reuse codes between clients.
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium">Containers & lockboxes</div>
                    <div className="text-[11px] text-ink-faint">Default is one container — add more if the items span multiple.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setContainers(prev => [...prev, { storage_location_id: null }])}
                    className="text-[11px] text-terracotta hover:text-terracotta-deep border border-hairline-strong px-2 py-1 rounded hover:border-terracotta"
                  >+ Add container</button>
                </div>
                {errors._containers && (
                  <div className="text-[11px] text-terracotta-deep mb-2 font-medium">{errors._containers}</div>
                )}
                {containers.length === 0 ? (
                  <div className="text-center text-ink-faint py-4 text-sm border border-dashed border-hairline rounded">
                    No containers assigned yet. Add at least one.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {containers.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={row.storage_location_id ?? ''}
                          onChange={e => {
                            const v = e.target.value ? Number(e.target.value) : null;
                            setContainers(prev => prev.map((r, i) => i === idx ? { ...r, storage_location_id: v } : r));
                          }}
                          className="field-input flex-1"
                        >
                          <option value="">— Pick a container —</option>
                          {(containerOptions ?? []).map(opt => (
                            <option key={opt.storage_location_id} value={opt.storage_location_id}>
                              {opt.location_code}
                              {opt.container_type && ` (${opt.container_type})`}
                              {opt.facility_name && ` — ${opt.facility_name}`}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setContainers(prev => prev.filter((_, i) => i !== idx))}
                          className="text-xs text-ink-faint hover:text-terracotta-deep px-2"
                          title="Remove this container"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                {containerOptions && containerOptions.length === 0 && (
                  <div className="text-[11px] text-terracotta-deep mt-2">
                    No containers or lockboxes are flagged yet. An admin can flag storage locations
                    at <code>/admin/lkp_storage_location</code> by setting "is_container_or_lockbox" to true.
                  </div>
                )}
              </div>
            </div>
          )}
        </Section>

        <Section title="Notes" hint="Gate codes, special instructions.">
          <FieldGrid>{NOTES_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section
          title="Crew"
          hint="Who's going on the delivery. Mark one person as team lead."
          actions={errors._crew && <span className="text-[11px] text-terracotta-deep font-medium">{errors._crew}</span>}
        >
          <SubformList<CrewRow>
            rows={crew}
            onChange={setCrew}
            emptyHint="No crew assigned yet."
            addLabel="+ Add crew member"
            newRow={() => ({ facility_staff_id: null, is_team_lead: false })}
            headers={
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <div>Person</div><div>Role</div>
              </div>
            }
            renderRow={(row, update) => (
              <div className="grid grid-cols-[1fr_140px] gap-3 items-center">
                <FkSelect
                  fkTable="tbl_facility_staff"
                  value={row.facility_staff_id}
                  required
                  onChange={v => update({ facility_staff_id: v })}
                />
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={row.is_team_lead}
                    onChange={e => update({ is_team_lead: e.target.checked })}
                    className="w-4 h-4 accent-terracotta"
                  />
                  Team lead
                </label>
              </div>
            )}
          />
        </Section>

        <Section
          title="Items loaded"
          hint="Inventory items going on this delivery."
          actions={
            <div className="flex items-center gap-3">
              {errors._items && <span className="text-[11px] text-terracotta-deep font-medium">{errors._items}</span>}
              <CopyItemsFromRequestButton
                requestId={values.client_provisioning_request_id ?? null}
                currentItemIds={items.map(i => i.corp_facility_inventory_item_id).filter((v): v is number => v != null)}
                onApply={(newRows, mode) => {
                  if (mode === 'replace') setItems(newRows);
                  else setItems(prev => [...prev, ...newRows]);
                }}
              />
            </div>
          }
        >
          <SubformList<ItemRow>
            rows={items}
            onChange={setItems}
            emptyHint="No items loaded yet."
            addLabel="+ Add item"
            newRow={() => ({ corp_facility_inventory_item_id: null })}
            renderRow={(row, update) => (
              <FkSelect
                fkTable="tbl_corp_facility_inventory_item"
                value={row.corp_facility_inventory_item_id}
                required
                onChange={v => update({ corp_facility_inventory_item_id: v })}
              />
            )}
          />
        </Section>

        <Section
          title="Vehicle"
          hint={hasVehicle ? 'Vehicle for this delivery.' : 'No vehicle assigned.'}
          actions={hasVehicle
            ? <button type="button" onClick={() => { setHasVehicle(false); setVehicle(blankVehicle()); }} className="text-xs text-terracotta hover:text-terracotta-deep">Remove vehicle</button>
            : <button type="button" onClick={() => setHasVehicle(true)} className="text-xs text-terracotta hover:text-terracotta-deep">+ Assign vehicle</button>
          }
        >
          {hasVehicle && (
            <>
              {errors._veh && <div className="text-[11px] text-terracotta-deep font-medium mb-2">{errors._veh}</div>}
              <FieldGrid>
                {VEHICLE_FIELDS.map(col => (
                  <Cell key={col.name} col={col}>
                    <Field
                      col={col}
                      value={(vehicle as any)[col.name]}
                      initialFkLabel={initialVehicleFkLabel(existing?.delivery, col.name)}
                      onChange={v => setVehicleField(col.name as keyof VehicleState, v)}
                    />
                  </Cell>
                ))}
              </FieldGrid>
            </>
          )}
        </Section>

        <div className="card flex items-center justify-between gap-3">
          <div>
            {!isNew && (
              <button type="button" onClick={handleDelete} disabled={deleteMut.isPending}
                className="text-sm text-terracotta hover:text-terracotta-deep disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting…' : 'Delete this delivery'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDirty && !saving && <span className="text-[11px] text-ink-faint italic">Unsaved changes</span>}
            <button type="button" onClick={() => safeNavigate(isNew ? '/deliveries' : `/deliveries/${id}`)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : (isNew ? 'Schedule delivery' : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function blankFormState(): Record<string, any> {
  return {
    client_provisioning_request_id: null,
    facility_staff_id: null,
    delivery_status_id: null,
    delivery_date: '',
    time_arrival_earliest: '', time_arrival_latest: '', time_delivery_complete: '',
    gate_code: '', notes: '',
    fulfillment_method_id: null,
    pickup_deadline: '',
    lock_code: '',
  };
}

function blankVehicle(): VehicleState {
  return {
    delivery_vehicle_type_id: null, vehicle_id: null, rental_agency_id: null,
    mileage_start: '', mileage_end: '', fuel_cost: '',
  };
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function dateOnly(value: any): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function initialFkLabel(d: any, columnName: string): string | undefined {
  if (!d) return undefined;
  switch (columnName) {
    case 'delivery_status_id':              return d.delivery_status;
    case 'client_provisioning_request_id':  return d.client_name && d.delivery_date ? `${d.client_name} — ${new Date(d.delivery_date).toLocaleDateString()}` : undefined;
    case 'facility_staff_id':               return d.scheduler_name;
    default: return undefined;
  }
}

function initialVehicleFkLabel(d: any, columnName: string): string | undefined {
  if (!d) return undefined;
  switch (columnName) {
    case 'delivery_vehicle_type_id': return d.vehicle_type;
    case 'vehicle_id':               return d.vehicle_license;
    case 'rental_agency_id':         return d.rental_agency;
    default: return undefined;
  }
}

/* ----------------------------------------------------------------- */
/*  Copy-items-from-request button                                    */
/*  Pulls the reserved inventory items off the selected provisioning  */
/*  request and adds them to the delivery's "Items loaded" list. Lets */
/*  staff skip the tedious re-entry that "we already matched these to */
/*  the request, why am I picking them again?" implies.               */
/* ----------------------------------------------------------------- */

function CopyItemsFromRequestButton({
  requestId,
  currentItemIds,
  onApply,
}: {
  requestId: number | null;
  currentItemIds: number[];
  onApply: (rows: ItemRow[], mode: 'replace' | 'append') => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!requestId) {
    return (
      <span className="text-[11px] text-ink-faint italic">
        Pick a request above to enable copy-items.
      </span>
    );
  }

  async function handleClick() {
    setError(null);
    setPending(true);
    try {
      const detail = await apiGet<{ matches: Array<{ inv_item_id: number }> }>(`/api/requests/${requestId}`);
      const matches = (detail.matches ?? []).map(m => Number(m.inv_item_id)).filter(Number.isFinite);
      if (matches.length === 0) {
        setError(
          'This request has no inventory items matched/reserved yet. ' +
          'Open the request and reserve inventory first, then come back.',
        );
        return;
      }

      // Deduplicate against items already on the form.
      const already = new Set(currentItemIds);
      const fresh = matches.filter(id => !already.has(id));
      const dupes = matches.length - fresh.length;

      // If nothing fresh, tell the user — don't silently no-op.
      if (fresh.length === 0) {
        setError(`All ${matches.length} reserved items are already on this delivery.`);
        return;
      }

      // Decide append vs. replace based on whether anything is here.
      let mode: 'append' | 'replace' = 'append';
      if (currentItemIds.length > 0) {
        const choice = window.confirm(
          `This request has ${matches.length} reserved item${matches.length === 1 ? '' : 's'} ` +
          `(${fresh.length} new${dupes > 0 ? `, ${dupes} already here` : ''}).\n\n` +
          'Click OK to APPEND the new items to the existing list, or Cancel and pick "Clear list" first to replace.',
        );
        if (!choice) return;
      }

      const rows: ItemRow[] = fresh.map(id => ({ corp_facility_inventory_item_id: id }));
      onApply(rows, mode);
    } catch (err: any) {
      setError(err.message ?? 'Could not load request items.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-[11px] text-terracotta hover:text-terracotta-deep border border-hairline-strong px-2 py-1 rounded hover:border-terracotta disabled:opacity-50"
        title="Pull reserved inventory items from the selected request into this delivery"
      >
        {pending ? 'Loading…' : '📋 Copy items from request'}
      </button>
      {error && (
        <span className="text-[11px] text-terracotta-deep ml-2 font-medium">{error}</span>
      )}
    </>
  );
}
