/**
 * Quick-create modal for a new Campaign. Used on DonationForm (gift
 * attribution) and EventForm (event ↔ campaign rollup).
 *
 * Minimum viable campaign — just enough for a donation or event to
 * roll up to. Richer fields (manager, public URL, etc.) get filled
 * in via the full editor at /campaigns/:id/edit later.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../../lib/api.ts';
import { FkSelect } from '../admin/FkSelect.tsx';
import type { QuickCreateContext } from '../admin/FkSelectWithCreate.tsx';
import { ModalShell, Row, Field } from './ModalShell.tsx';

export function CampaignQuickCreateModal({ onCreated, onCancel }: QuickCreateContext) {
  const [v, setV] = useState({
    campaign_name: '',
    campaign_type_id: null as number | null,
    campaign_status_id: null as number | null,
    fund_id: null as number | null,
    goal_amount: '',
    start_date: '',
    end_date: '',
    notes: '',
  });
  const [topError, setTopError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => apiPost<{ campaign_id: number; label: string }>('/api/quick-create/campaign', {
      campaign_name: v.campaign_name.trim(),
      campaign_type_id: v.campaign_type_id,
      campaign_status_id: v.campaign_status_id,
      fund_id: v.fund_id,
      goal_amount: v.goal_amount ? Number(v.goal_amount) : null,
      start_date: v.start_date || null,
      end_date: v.end_date || null,
      notes: v.notes.trim() || null,
    }),
    onSuccess: (r) => onCreated(r.campaign_id, r.label),
    onError: (err: any) => setTopError(err.message ?? 'Failed to create campaign'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    const missing: string[] = [];
    if (!v.campaign_name.trim()) missing.push('Campaign name');
    if (!v.campaign_type_id) missing.push('Type');
    if (!v.campaign_status_id) missing.push('Status');
    if (missing.length) { setTopError(`Required: ${missing.join(', ')}`); return; }
    createMut.mutate();
  }

  return (
    <ModalShell
      title="New campaign"
      subtitle="A fundraising campaign (annual fund, capital campaign, special appeal, etc.). Donations and events can roll up to it."
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitting={createMut.isPending}
      topError={topError}
    >
      <Row>
        <Field label="Campaign name" required full>
          <input type="text" className="field-input" value={v.campaign_name} onChange={e => setV({ ...v, campaign_name: e.target.value })} maxLength={150} placeholder="e.g. Annual Fund 2026" required />
        </Field>
      </Row>
      <Row>
        <Field label="Type" required>
          <FkSelect fkTable="lkp_campaign_type" value={v.campaign_type_id} onChange={id => setV({ ...v, campaign_type_id: id })} required />
        </Field>
        <Field label="Status" required>
          <FkSelect fkTable="lkp_campaign_status" value={v.campaign_status_id} onChange={id => setV({ ...v, campaign_status_id: id })} required />
        </Field>
      </Row>
      <Row>
        <Field label="Fund (optional)">
          <FkSelect fkTable="lkp_fund" value={v.fund_id} onChange={id => setV({ ...v, fund_id: id })} />
        </Field>
        <Field label="Goal amount (optional)">
          <input type="number" step="0.01" min="0" className="field-input" value={v.goal_amount} onChange={e => setV({ ...v, goal_amount: e.target.value })} placeholder="0.00" />
        </Field>
      </Row>
      <Row>
        <Field label="Start date">
          <input type="date" className="field-input" value={v.start_date} onChange={e => setV({ ...v, start_date: e.target.value })} />
        </Field>
        <Field label="End date">
          <input type="date" className="field-input" value={v.end_date} onChange={e => setV({ ...v, end_date: e.target.value })} />
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
