/**
 * Quick-create modal for a new Pledge. Used on DonationForm when a
 * gift is meant to apply to a pledge that doesn't exist in the system
 * yet. Has a nested "+ New donor" affordance so a missing donor can be
 * created without backing out.
 *
 * Accepts an optional defaultDonorId so the caller can pre-select a
 * donor (e.g., the donor already chosen on the parent Donation form).
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../../lib/api.ts';
import { FkSelect } from '../admin/FkSelect.tsx';
import { FkSelectWithCreate, type QuickCreateContext } from '../admin/FkSelectWithCreate.tsx';
import { DonorQuickCreateModal } from '../donor/DonorQuickCreateModal.tsx';
import { ModalShell, Row, Field } from './ModalShell.tsx';

interface Props extends QuickCreateContext {
  defaultDonorId?: number | null;
}

export function PledgeQuickCreateModal({ onCreated, onCancel, defaultDonorId }: Props) {
  const [v, setV] = useState({
    donor_id: defaultDonorId ?? null as number | null,
    fund_id: null as number | null,
    total_pledged_amount: '',
    pledge_date: new Date().toISOString().slice(0, 10),
    pledge_status_id: null as number | null,
    expected_fulfillment_date: '',
    notes: '',
  });
  const [topError, setTopError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => apiPost<{ pledge_id: number; label: string }>('/api/quick-create/pledge', {
      donor_id: v.donor_id,
      fund_id: v.fund_id,
      total_pledged_amount: Number(v.total_pledged_amount),
      pledge_date: v.pledge_date,
      pledge_status_id: v.pledge_status_id,
      expected_fulfillment_date: v.expected_fulfillment_date || null,
      notes: v.notes.trim() || null,
    }),
    onSuccess: (r) => onCreated(r.pledge_id, r.label),
    onError: (err: any) => setTopError(err.message ?? 'Failed to create pledge'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    const missing: string[] = [];
    if (!v.donor_id) missing.push('Donor');
    if (!v.total_pledged_amount || Number(v.total_pledged_amount) <= 0) missing.push('Pledge amount (positive)');
    if (!v.pledge_date) missing.push('Pledge date');
    if (!v.pledge_status_id) missing.push('Status');
    if (missing.length) { setTopError(`Required: ${missing.join(', ')}`); return; }
    createMut.mutate();
  }

  return (
    <ModalShell
      title="New pledge"
      subtitle="A commitment to give. Donations on the parent form can be linked to this pledge after it's created."
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitting={createMut.isPending}
      topError={topError}
    >
      <Row>
        <Field label="Donor" required full>
          {/* Nested + New donor — if the donor isn't in the system yet,
              the chain opens DonorQuickCreate on top of this modal. */}
          <FkSelectWithCreate
            fkTable="tbl_donor"
            value={v.donor_id}
            required
            onChange={id => setV({ ...v, donor_id: id })}
            newButtonLabel="+ New donor"
            renderModal={ctx => <DonorQuickCreateModal {...ctx} />}
          />
        </Field>
      </Row>
      <Row>
        <Field label="Pledge amount" required>
          <input type="number" step="0.01" min="0.01" className="field-input" value={v.total_pledged_amount} onChange={e => setV({ ...v, total_pledged_amount: e.target.value })} required />
        </Field>
        <Field label="Pledge date" required>
          <input type="date" className="field-input" value={v.pledge_date} onChange={e => setV({ ...v, pledge_date: e.target.value })} required />
        </Field>
      </Row>
      <Row>
        <Field label="Status" required>
          <FkSelect fkTable="lkp_pledge_status" value={v.pledge_status_id} onChange={id => setV({ ...v, pledge_status_id: id })} required />
        </Field>
        <Field label="Fund (optional)">
          <FkSelect fkTable="lkp_fund" value={v.fund_id} onChange={id => setV({ ...v, fund_id: id })} />
        </Field>
      </Row>
      <Row>
        <Field label="Expected by" full>
          <input type="date" className="field-input" value={v.expected_fulfillment_date} onChange={e => setV({ ...v, expected_fulfillment_date: e.target.value })} />
        </Field>
      </Row>
      <Row>
        <Field label="Notes" full>
          <textarea rows={2} className="field-input" value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} maxLength={500} />
        </Field>
      </Row>
    </ModalShell>
  );
}
