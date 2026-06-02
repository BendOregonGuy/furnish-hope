/**
 * Quick-create modal for a new Contact. Used on DonationForm (soft-credit
 * contact) and EventForm (attendee contacts). Minimal fields because the
 * common case is "I just need this person in the system so I can credit
 * them" — full profile editing happens at /admin/tbl_contact.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../../lib/api.ts';
import { FkSelect } from '../admin/FkSelect.tsx';
import type { QuickCreateContext } from '../admin/FkSelectWithCreate.tsx';
import { ModalShell, Row, Field } from './ModalShell.tsx';

export function ContactQuickCreateModal({
  onCreated, onCancel,
  defaultContactTypeId,
}: QuickCreateContext & { defaultContactTypeId?: number }) {
  const [v, setV] = useState({
    contact_type_id: defaultContactTypeId ?? null as number | null,
    first_name: '', last_name: '',
    mobile_phone: '', email: '', description: '',
  });
  const [topError, setTopError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => apiPost<{ contact_id: number; label: string }>('/api/quick-create/contact', {
      contact_type_id: v.contact_type_id,
      first_name: v.first_name.trim(),
      last_name: v.last_name.trim(),
      mobile_phone: v.mobile_phone.trim() || null,
      email: v.email.trim() || null,
      description: v.description.trim() || null,
    }),
    onSuccess: (r) => onCreated(r.contact_id, r.label),
    onError: (err: any) => setTopError(err.message ?? 'Failed to create contact'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    const missing: string[] = [];
    if (!v.contact_type_id) missing.push('Type');
    if (!v.first_name.trim()) missing.push('First name');
    if (!v.last_name.trim()) missing.push('Last name');
    if (missing.length) { setTopError(`Required: ${missing.join(', ')}`); return; }
    createMut.mutate();
  }

  return (
    <ModalShell
      title="New contact"
      subtitle="A bare person record. Use this when you need to reference someone but they're not yet a donor / client / staff."
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitting={createMut.isPending}
      topError={topError}
    >
      <Row>
        <Field label="First name" required>
          <input type="text" className="field-input" value={v.first_name} onChange={e => setV({ ...v, first_name: e.target.value })} maxLength={50} required />
        </Field>
        <Field label="Last name" required>
          <input type="text" className="field-input" value={v.last_name} onChange={e => setV({ ...v, last_name: e.target.value })} maxLength={50} required />
        </Field>
      </Row>
      <Row>
        <Field label="Contact type" required>
          <FkSelect fkTable="lkp_contact_type" value={v.contact_type_id} onChange={id => setV({ ...v, contact_type_id: id })} required />
        </Field>
        <Field label="Mobile phone">
          <input type="tel" className="field-input" value={v.mobile_phone} onChange={e => setV({ ...v, mobile_phone: e.target.value })} maxLength={20} />
        </Field>
      </Row>
      <Row>
        <Field label="Email" full>
          <input type="email" className="field-input" value={v.email} onChange={e => setV({ ...v, email: e.target.value })} maxLength={100} />
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
