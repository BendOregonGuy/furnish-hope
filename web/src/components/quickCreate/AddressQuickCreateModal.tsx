/**
 * Quick-create modal for a new Address. Used wherever a form's address_id
 * dropdown might be empty (pickup pickup_address, event venue, etc.).
 *
 * Returns { address_id, label } to the FK dropdown that opened it.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../../lib/api.ts';
import { FkSelect } from '../admin/FkSelect.tsx';
import type { QuickCreateContext } from '../admin/FkSelectWithCreate.tsx';
import { ModalShell, Row, Field } from './ModalShell.tsx';

export function AddressQuickCreateModal({ onCreated, onCancel }: QuickCreateContext) {
  const [v, setV] = useState({
    address_name: 'Home', address_type_id: null as number | null,
    address: '', address2: '',
    city_id: null as number | null, county_id: null as number | null, state_id: null as number | null,
    postalcode: '', description: '',
  });
  const [topError, setTopError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => apiPost<{ address_id: number; label: string }>('/api/quick-create/address', {
      address_name: v.address_name.trim(),
      address_type_id: v.address_type_id,
      address: v.address.trim(),
      address2: v.address2.trim() || null,
      city_id: v.city_id,
      county_id: v.county_id,
      state_id: v.state_id,
      postalcode: v.postalcode.trim(),
      description: v.description.trim() || null,
    }),
    onSuccess: (r) => onCreated(r.address_id, r.label),
    onError: (err: any) => setTopError(err.message ?? 'Failed to create address'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    const missing: string[] = [];
    if (!v.address_name.trim()) missing.push('Label');
    if (!v.address_type_id) missing.push('Type');
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
      title="New address"
      subtitle="Adds an address row that can be referenced anywhere — donor home, pickup location, event venue."
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitting={createMut.isPending}
      topError={topError}
    >
      <Row>
        <Field label="Label" required>
          <input type="text" className="field-input" value={v.address_name} onChange={e => setV({ ...v, address_name: e.target.value })} placeholder="Home, Warehouse, Venue …" maxLength={50} />
        </Field>
        <Field label="Type" required>
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
      <Row>
        <Field label="Notes" full>
          <textarea rows={2} className="field-input" value={v.description} onChange={e => setV({ ...v, description: e.target.value })} maxLength={100} />
        </Field>
      </Row>
    </ModalShell>
  );
}
