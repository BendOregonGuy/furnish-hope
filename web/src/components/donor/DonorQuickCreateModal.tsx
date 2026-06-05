/**
 * Quick-create modal for a new Donor. Composes person + contact + address
 * fields inline — same approach as ClientForm/VolunteerForm — so the user
 * fills out one focused form and the backend creates all three rows
 * atomically (POST /api/donors).
 *
 * Opens from any FK dropdown wrapped in <FkSelectWithCreate fkTable="tbl_donor" />.
 *
 * Designed to be the *minimum viable* donor — only the columns required to
 * satisfy database constraints. The full editor at /admin/tbl_donor is still
 * available for richer fields (donor stage, employer match, do-not-contact,
 * etc.) — and a "Save & open full editor" button surfaces it.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../../lib/api.ts';
import { FkSelect } from '../admin/FkSelect.tsx';
import type { QuickCreateContext } from '../admin/FkSelectWithCreate.tsx';

interface FormState {
  // Contact
  first_name: string;
  middle_name: string;
  last_name: string;
  mobile_phone: string;
  home_phone: string;
  email: string;
  gender_id: number | null;
  ethnicity_id: number | null;
  birth_date: string;
  // Address
  address_name: string;
  address_type_id: number | null;
  address: string;
  address2: string;
  city_id: number | null;
  county_id: number | null;
  state_id: number | null;
  postalcode: string;
  // Donor
  donor_type_id: number | null;
  howtheyfoundus_id: number | null;
  is_recurring: boolean;
  is_anonymous: boolean;
  donor_advised_fund_name: string;
  description: string;
}

const initial: FormState = {
  first_name: '', middle_name: '', last_name: '',
  mobile_phone: '', home_phone: '', email: '',
  gender_id: null, ethnicity_id: null, birth_date: '',
  address_name: 'Home', address_type_id: null,
  address: '', address2: '',
  city_id: null, county_id: null, state_id: null, postalcode: '',
  donor_type_id: null, howtheyfoundus_id: null,
  is_recurring: false, is_anonymous: false,
  donor_advised_fund_name: '', description: '',
};

export function DonorQuickCreateModal({ onCreated, onCancel }: QuickCreateContext) {
  const [v, setV] = useState<FormState>(initial);
  const [topError, setTopError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setV(prev => ({ ...prev, [key]: val }));
  }

  const createMut = useMutation({
    mutationFn: () => apiPost<{ donor_id: number; label: string }>('/api/donors', {
      contact: {
        first_name: v.first_name.trim(),
        middle_name: v.middle_name.trim() || null,
        last_name: v.last_name.trim(),
        gender_id: v.gender_id,
        ethnicity_id: v.ethnicity_id,
        birth_date: v.birth_date || null,
        mobile_phone: v.mobile_phone.trim() || null,
        home_phone: v.home_phone.trim() || null,
        email: v.email.trim() || null,
      },
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
      donor: {
        donor_type_id: v.donor_type_id,
        howtheyfoundus_id: v.howtheyfoundus_id,
        is_recurring: v.is_recurring,
        is_anonymous: v.is_anonymous,
        donor_advised_fund_name: v.donor_advised_fund_name.trim() || null,
        description: v.description.trim() || null,
      },
    }),
    onSuccess: (r) => onCreated(r.donor_id, r.label),
    onError: (err: any) => setTopError(err.message ?? 'Failed to create donor'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // stopPropagation so this submit doesn't bubble out to whatever
    // outer admin / pickup / donation form opened the modal. If it
    // bubbles, that outer form's onSubmit fires too and tries to save
    // its own (incomplete) record, navigating away and wiping data.
    e.stopPropagation();
    setTopError(null);
    // Light client-side validation — the server validates authoritatively
    // but catching obvious gaps here gives faster feedback.
    const missing: string[] = [];
    if (!v.first_name.trim()) missing.push('First name');
    if (!v.last_name.trim()) missing.push('Last name');
    if (!v.address.trim()) missing.push('Street address');
    if (!v.address_type_id) missing.push('Address type');
    if (!v.city_id) missing.push('City');
    if (!v.county_id) missing.push('County');
    if (!v.state_id) missing.push('State');
    if (!v.postalcode.trim()) missing.push('ZIP / postal code');
    if (!v.donor_type_id) missing.push('Donor type');
    if (!v.howtheyfoundus_id) missing.push('How they found us');
    if (missing.length) { setTopError(`Required: ${missing.join(', ')}`); return; }
    createMut.mutate();
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-hairline flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-xl font-medium m-0">New donor</h2>
          <p className="text-[11px] text-ink-faint mt-0.5">Adds a person, primary address, and donor record in one step.</p>
        </div>
        <button type="button" onClick={onCancel} className="text-ink-faint hover:text-terracotta text-xl leading-none">×</button>
      </div>

      {/* Body — scrolls if it gets tall */}
      <div className="px-5 py-4 max-h-[calc(100vh-220px)] overflow-y-auto space-y-5">

        {/* Person section */}
        <Section title="Person">
          <Row>
            <Field label="First name" required>
              <input type="text" className="field-input" value={v.first_name} onChange={e => set('first_name', e.target.value)} required maxLength={50} />
            </Field>
            <Field label="Last name" required>
              <input type="text" className="field-input" value={v.last_name} onChange={e => set('last_name', e.target.value)} required maxLength={50} />
            </Field>
          </Row>
          <Row>
            <Field label="Mobile phone">
              <input type="tel" className="field-input" value={v.mobile_phone} onChange={e => set('mobile_phone', e.target.value)} maxLength={20} />
            </Field>
            <Field label="Email">
              <input type="email" className="field-input" value={v.email} onChange={e => set('email', e.target.value)} maxLength={100} />
            </Field>
          </Row>
        </Section>

        {/* Address section */}
        <Section title="Primary address">
          <Row>
            <Field label="Label" required>
              <input type="text" className="field-input" value={v.address_name} onChange={e => set('address_name', e.target.value)} placeholder="Home, Office, …" maxLength={50} />
            </Field>
            <Field label="Address type" required>
              <FkSelect fkTable="lkp_address_type" value={v.address_type_id} onChange={id => set('address_type_id', id)} required />
            </Field>
          </Row>
          <Row>
            <Field label="Street" required>
              <input type="text" className="field-input" value={v.address} onChange={e => set('address', e.target.value)} maxLength={100} required />
            </Field>
            <Field label="Apt / suite">
              <input type="text" className="field-input" value={v.address2} onChange={e => set('address2', e.target.value)} maxLength={50} />
            </Field>
          </Row>
          <Row>
            <Field label="City" required>
              <FkSelect fkTable="lkp_city" value={v.city_id} onChange={id => set('city_id', id)} required />
            </Field>
            <Field label="County" required>
              <FkSelect fkTable="lkp_county" value={v.county_id} onChange={id => set('county_id', id)} required />
            </Field>
          </Row>
          <Row>
            <Field label="State" required>
              <FkSelect fkTable="lkp_state" value={v.state_id} onChange={id => set('state_id', id)} required />
            </Field>
            <Field label="ZIP" required>
              <input type="text" className="field-input" value={v.postalcode} onChange={e => set('postalcode', e.target.value)} maxLength={10} required />
            </Field>
          </Row>
        </Section>

        {/* Donor section */}
        <Section title="Donor">
          <Row>
            <Field label="Donor type" required>
              <FkSelect fkTable="lkp_donor_type" value={v.donor_type_id} onChange={id => set('donor_type_id', id)} required />
            </Field>
            <Field label="How they found us" required>
              <FkSelect fkTable="lkp_howtheyfoundus" value={v.howtheyfoundus_id} onChange={id => set('howtheyfoundus_id', id)} required />
            </Field>
          </Row>
          <Row>
            <Field label="Recurring gift?">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer h-9">
                <input type="checkbox" checked={v.is_recurring} onChange={e => set('is_recurring', e.target.checked)} className="w-4 h-4 accent-terracotta" />
                <span className="text-ink-soft">Yes, gives on a recurring schedule</span>
              </label>
            </Field>
            <Field label="Public anonymity?">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer h-9">
                <input type="checkbox" checked={v.is_anonymous} onChange={e => set('is_anonymous', e.target.checked)} className="w-4 h-4 accent-terracotta" />
                <span className="text-ink-soft">Donor wants public anonymity (real name stays visible to staff)</span>
              </label>
            </Field>
          </Row>
          <Row>
            <Field label="DAF / fund name" full>
              <input type="text" className="field-input" value={v.donor_advised_fund_name} onChange={e => set('donor_advised_fund_name', e.target.value)} maxLength={100} placeholder="If giving via a donor-advised fund" />
            </Field>
          </Row>
          <Row>
            <Field label="Notes" full>
              <textarea rows={2} className="field-input" value={v.description} onChange={e => set('description', e.target.value)} maxLength={100} />
            </Field>
          </Row>
        </Section>

        {topError && (
          <div className="p-2.5 bg-terracotta-soft text-terracotta-deep rounded-md text-xs">{topError}</div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-hairline flex items-center justify-between gap-2 bg-cream/40 rounded-b-lg">
        <div className="text-[11px] text-ink-faint">
          Full editor at <code className="font-mono">/admin/tbl_donor</code> has all fields (stage, employer match, contact preferences).
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost text-xs">Cancel</button>
          <button type="submit" disabled={createMut.isPending} className="btn-primary text-xs disabled:opacity-60">
            {createMut.isPending ? 'Saving…' : 'Save & select'}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ----------------------------------------------------------------- */
/*  Tiny inline layout helpers                                        */
/* ----------------------------------------------------------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] tracking-widest uppercase text-ink-faint font-medium mb-2">{title}</div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="field-label">{label}{required && ' *'}</label>
      {children}
    </div>
  );
}
