/**
 * Quick-create modal for a new Facility Staff member. Contact info is
 * composed inline (every staff row needs one). Home Facility uses the
 * "+ New" affordance so the user can also create a new facility in a
 * nested modal — same UX as the donor flow.
 *
 * Used on DeliveryForm (scheduler), RequestForm (recorder), and
 * CampaignForm (manager).
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../../lib/api.ts';
import { FkSelectWithCreate } from '../admin/FkSelectWithCreate.tsx';
import type { QuickCreateContext } from '../admin/FkSelectWithCreate.tsx';
import { CorpFacilityQuickCreateModal } from './CorpFacilityQuickCreateModal.tsx';
import { ModalShell, Section, Row, Field } from './ModalShell.tsx';

export function FacilityStaffQuickCreateModal({ onCreated, onCancel }: QuickCreateContext) {
  const [v, setV] = useState({
    corp_facility_id: null as number | null,
    is_volunteer: false,
    hire_date: '',
    description: '',
    first_name: '', last_name: '',
    mobile_phone: '', email: '',
  });
  const [topError, setTopError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => apiPost<{ facility_staff_id: number; label: string }>('/api/quick-create/facility-staff', {
      corp_facility_id: v.corp_facility_id,
      is_volunteer: v.is_volunteer,
      hire_date: v.hire_date || null,
      description: v.description.trim() || null,
      contact: {
        first_name: v.first_name.trim(),
        last_name: v.last_name.trim(),
        mobile_phone: v.mobile_phone.trim() || null,
        email: v.email.trim() || null,
      },
    }),
    onSuccess: (r) => onCreated(r.facility_staff_id, r.label),
    onError: (err: any) => setTopError(err.message ?? 'Failed to create staff member'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    const missing: string[] = [];
    if (!v.corp_facility_id) missing.push('Home facility');
    if (!v.first_name.trim()) missing.push('First name');
    if (!v.last_name.trim()) missing.push('Last name');
    if (missing.length) { setTopError(`Required: ${missing.join(', ')}`); return; }
    createMut.mutate();
  }

  return (
    <ModalShell
      title="New staff / volunteer"
      subtitle="Adds a person to the staff roster. Toggle the volunteer flag if this is a volunteer rather than paid staff."
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitting={createMut.isPending}
      topError={topError}
    >
      <Section title="Person">
        <Row>
          <Field label="First name" required>
            <input type="text" className="field-input" value={v.first_name} onChange={e => setV({ ...v, first_name: e.target.value })} maxLength={50} required />
          </Field>
          <Field label="Last name" required>
            <input type="text" className="field-input" value={v.last_name} onChange={e => setV({ ...v, last_name: e.target.value })} maxLength={50} required />
          </Field>
        </Row>
        <Row>
          <Field label="Mobile phone">
            <input type="tel" className="field-input" value={v.mobile_phone} onChange={e => setV({ ...v, mobile_phone: e.target.value })} maxLength={20} />
          </Field>
          <Field label="Email">
            <input type="email" className="field-input" value={v.email} onChange={e => setV({ ...v, email: e.target.value })} maxLength={100} />
          </Field>
        </Row>
      </Section>

      <Section title="Role">
        <Row>
          <Field label="Home facility" required>
            {/* Nested + New — opens the CorpFacility modal on top of this one
                so a brand-new facility can be created without backing out. */}
            <FkSelectWithCreate
              fkTable="tbl_corp_facility"
              value={v.corp_facility_id}
              required
              onChange={id => setV({ ...v, corp_facility_id: id })}
              newButtonLabel="+ New facility"
              renderModal={ctx => <CorpFacilityQuickCreateModal {...ctx} />}
            />
          </Field>
          <Field label="Status">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer h-9">
              <input type="checkbox" checked={v.is_volunteer} onChange={e => setV({ ...v, is_volunteer: e.target.checked })} className="w-4 h-4 accent-terracotta" />
              <span className="text-ink-soft">Volunteer (uncheck for paid staff)</span>
            </label>
          </Field>
        </Row>
        <Row>
          <Field label="Start / hire date">
            <input type="date" className="field-input" value={v.hire_date} onChange={e => setV({ ...v, hire_date: e.target.value })} />
          </Field>
          <Field label="Notes">
            <input type="text" className="field-input" value={v.description} onChange={e => setV({ ...v, description: e.target.value })} maxLength={100} />
          </Field>
        </Row>
      </Section>
    </ModalShell>
  );
}
