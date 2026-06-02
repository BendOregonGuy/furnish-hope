/**
 * Quick-create modal for a new Corp Facility (warehouse, office, etc.).
 * Address is composed inline (every facility needs one) so this single
 * modal creates two rows atomically — no nested modal needed.
 *
 * Used on RequestForm (fulfilling facility) and VolunteerForm (home
 * facility).
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../../lib/api.ts';
import { FkSelect } from '../admin/FkSelect.tsx';
import type { QuickCreateContext } from '../admin/FkSelectWithCreate.tsx';
import { ModalShell, Section, Row, Field } from './ModalShell.tsx';

export function CorpFacilityQuickCreateModal({ onCreated, onCancel }: QuickCreateContext) {
  const [v, setV] = useState({
    facility_name: '', facility_type_id: null as number | null, description: '',
    address_name: 'Main', address_type_id: null as number | null,
    address: '', address2: '',
    city_id: null as number | null, county_id: null as number | null, state_id: null as number | null,
    postalcode: '',
  });
  const [topError, setTopError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => apiPost<{ corp_facility_id: number; label: string }>('/api/quick-create/corp-facility', {
      facility_name: v.facility_name.trim(),
      facility_type_id: v.facility_type_id,
      description: v.description.trim() || null,
      address: {
        address_name: v.address_name.trim(),
        address_type_id: v.address_type_id,
        address: v.address.trim(),
        address2: v.address2.trim() || null,
        city_id: v.city_id,
        county_id: v.county_id,
        state_id: v.state_id,
        postalcode: v.postalcode.trim(),
      },
    }),
    onSuccess: (r) => onCreated(r.corp_facility_id, r.label),
    onError: (err: any) => setTopError(err.message ?? 'Failed to create facility'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    const missing: string[] = [];
    if (!v.facility_name.trim()) missing.push('Facility name');
    if (!v.facility_type_id) missing.push('Facility type');
    if (!v.address_name.trim()) missing.push('Address label');
    if (!v.address_type_id) missing.push('Address type');
    if (!v.address.trim()) missing.push('Street');
    if (!v.city_id) missing.push('City');
    if (!v.county_id) missing.push('County');
    if (!v.state_id) missing.push('State');
    if (!v.postalcode.trim()) missing.push('ZIP');
    if (missing.length) { setTopError(`Required: ${missing.join(', ')}`); return; }
    createMut.mutate();
  }

  return (
    <ModalShell
      title="New facility"
      subtitle="Warehouse, office, satellite location. Address is created with it in one step."
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitting={createMut.isPending}
      topError={topError}
    >
      <Section title="Facility">
        <Row>
          <Field label="Name" required>
            <input type="text" className="field-input" value={v.facility_name} onChange={e => setV({ ...v, facility_name: e.target.value })} maxLength={100} placeholder="e.g. Bend Warehouse" required />
          </Field>
          <Field label="Type" required>
            <FkSelect fkTable="lkp_facility_type" value={v.facility_type_id} onChange={id => setV({ ...v, facility_type_id: id })} required />
          </Field>
        </Row>
        <Row>
          <Field label="Notes" full>
            <textarea rows={2} className="field-input" value={v.description} onChange={e => setV({ ...v, description: e.target.value })} maxLength={100} />
          </Field>
        </Row>
      </Section>

      <Section title="Address">
        <Row>
          <Field label="Label" required>
            <input type="text" className="field-input" value={v.address_name} onChange={e => setV({ ...v, address_name: e.target.value })} maxLength={50} />
          </Field>
          <Field label="Address type" required>
            <FkSelect fkTable="lkp_address_type" value={v.address_type_id} onChange={id => setV({ ...v, address_type_id: id })} required />
          </Field>
        </Row>
        <Row>
          <Field label="Street" required>
            <input type="text" className="field-input" value={v.address} onChange={e => setV({ ...v, address: e.target.value })} maxLength={100} required />
          </Field>
          <Field label="Apt / suite">
            <input type="text" className="field-input" value={v.address2} onChange={e => setV({ ...v, address2: e.target.value })} maxLength={50} />
          </Field>
        </Row>
        <Row>
          <Field label="City" required>
            <FkSelect fkTable="lkp_city" value={v.city_id} onChange={id => setV({ ...v, city_id: id })} required />
          </Field>
          <Field label="County" required>
            <FkSelect fkTable="lkp_county" value={v.county_id} onChange={id => setV({ ...v, county_id: id })} required />
          </Field>
        </Row>
        <Row>
          <Field label="State" required>
            <FkSelect fkTable="lkp_state" value={v.state_id} onChange={id => setV({ ...v, state_id: id })} required />
          </Field>
          <Field label="ZIP" required>
            <input type="text" className="field-input" value={v.postalcode} onChange={e => setV({ ...v, postalcode: e.target.value })} maxLength={10} required />
          </Field>
        </Row>
      </Section>
    </ModalShell>
  );
}
