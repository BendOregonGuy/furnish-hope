/**
 * Quick-create modal for a new Vehicle. Used on Pickup (assigned vehicle)
 * and Delivery (company vehicle) forms.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../../lib/api.ts';
import { FkSelect } from '../admin/FkSelect.tsx';
import type { QuickCreateContext } from '../admin/FkSelectWithCreate.tsx';
import { ModalShell, Row, Field } from './ModalShell.tsx';

export function VehicleQuickCreateModal({ onCreated, onCancel }: QuickCreateContext) {
  const [v, setV] = useState({
    corp_facility_id: null as number | null,
    vehicle_make_id: null as number | null,
    vehicle_model_id: null as number | null,
    vehicle_type_id: null as number | null,
    model_year: new Date().getFullYear() - 5,  // sensible default — 5yo vehicle
    vehicle_license: '',
    description: '',
  });
  const [topError, setTopError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => apiPost<{ vehicle_id: number; label: string }>('/api/quick-create/vehicle', {
      corp_facility_id: v.corp_facility_id,
      vehicle_make_id: v.vehicle_make_id,
      vehicle_model_id: v.vehicle_model_id,
      vehicle_type_id: v.vehicle_type_id,
      model_year: v.model_year,
      vehicle_license: v.vehicle_license.trim() || null,
      description: v.description.trim() || null,
    }),
    onSuccess: (r) => onCreated(r.vehicle_id, r.label),
    onError: (err: any) => setTopError(err.message ?? 'Failed to create vehicle'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    const missing: string[] = [];
    if (!v.vehicle_make_id) missing.push('Make');
    if (!v.vehicle_model_id) missing.push('Model');
    if (!v.vehicle_type_id) missing.push('Type');
    if (!v.model_year) missing.push('Year');
    if (missing.length) { setTopError(`Required: ${missing.join(', ')}`); return; }
    createMut.mutate();
  }

  return (
    <ModalShell
      title="New vehicle"
      subtitle="Add a company vehicle that can be assigned to pickups and deliveries."
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitting={createMut.isPending}
      topError={topError}
    >
      <Row>
        <Field label="Make" required>
          <FkSelect fkTable="lkp_vehicle_make" value={v.vehicle_make_id} onChange={id => setV({ ...v, vehicle_make_id: id })} required />
        </Field>
        <Field label="Model" required>
          <FkSelect fkTable="lkp_vehicle_model" value={v.vehicle_model_id} onChange={id => setV({ ...v, vehicle_model_id: id })} required />
        </Field>
      </Row>
      <Row>
        <Field label="Year" required>
          <input type="number" className="field-input" value={v.model_year || ''} onChange={e => setV({ ...v, model_year: Number(e.target.value) })} min={1900} max={2100} required />
        </Field>
        <Field label="Type" required>
          <FkSelect fkTable="lkp_vehicle_type" value={v.vehicle_type_id} onChange={id => setV({ ...v, vehicle_type_id: id })} required />
        </Field>
      </Row>
      <Row>
        <Field label="License plate">
          <input type="text" className="field-input font-mono" value={v.vehicle_license} onChange={e => setV({ ...v, vehicle_license: e.target.value })} maxLength={15} />
        </Field>
        <Field label="Home facility">
          <FkSelect fkTable="tbl_corp_facility" value={v.corp_facility_id} onChange={id => setV({ ...v, corp_facility_id: id })} />
        </Field>
      </Row>
      <Row>
        <Field label="Notes" full>
          <textarea rows={2} className="field-input" value={v.description} onChange={e => setV({ ...v, description: e.target.value })} maxLength={100} />
        </Field>
      </Row>
    </ModalShell>
  );
}
