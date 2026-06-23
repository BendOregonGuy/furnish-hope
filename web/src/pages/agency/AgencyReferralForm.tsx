/**
 * Refer-a-household form. Atomic create of address + contact + client
 * + referral linking it to this caseworker. Minimal — the goal is to
 * remove burden from FH staff, not duplicate the full intake form.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../lib/api.ts';
import { Loading } from '../../components/ui.tsx';
import { DedupSuggestions } from '../../components/DedupSuggestions.tsx';
import { CheckboxGroup } from '../../components/CheckboxGroup.tsx';

interface ClientTypeRow   { client_type_id: number; client_type: string }
interface CityRow         { city_id: number;        city: string }
interface CountyRow       { county_id: number;      county: string }
interface StateRow        { state_id: number;       state: string }
interface ItemCategoryRow { item_category_id: number; item_category: string }

interface ItemLine {
  item_category_id: number | '';
  quantity: number;
  priority: '' | 'low' | 'medium' | 'high';
  item_notes: string;
}

export function AgencyReferralForm() {
  const navigate = useNavigate();

  // All reference data comes from /api/agency/lookups/* — a narrow
  // allowlisted mirror of /api/lookups that agency-role users can
  // hit. Staff-only data (donors, internal entities) is never
  // exposed via that endpoint.
  const { data: clientTypes } = useQuery<ClientTypeRow[]>({
    queryKey: ['agency', 'lookup', 'client_type'],
    queryFn: () => apiGet('/api/agency/lookups/lkp_client_type'),
    staleTime: 5 * 60_000,
  });
  const { data: cities } = useQuery<CityRow[]>({
    queryKey: ['agency', 'lookup', 'city'],
    queryFn: () => apiGet('/api/agency/lookups/lkp_city'),
    staleTime: 5 * 60_000,
  });
  const { data: counties } = useQuery<CountyRow[]>({
    queryKey: ['agency', 'lookup', 'county'],
    queryFn: () => apiGet('/api/agency/lookups/lkp_county'),
    staleTime: 5 * 60_000,
  });
  const { data: states } = useQuery<StateRow[]>({
    queryKey: ['agency', 'lookup', 'state'],
    queryFn: () => apiGet('/api/agency/lookups/lkp_state'),
    staleTime: 5 * 60_000,
  });
  const { data: itemCategories } = useQuery<ItemCategoryRow[]>({
    queryKey: ['agency', 'lookup', 'item_category'],
    queryFn: () => apiGet('/api/agency/lookups/lkp_item_category'),
    staleTime: 5 * 60_000,
  });

  const [first, setFirst]       = useState('');
  const [last, setLast]         = useState('');
  const [dob, setDob]           = useState('');
  const [email, setEmail]       = useState('');
  const [mobile, setMobile]     = useState('');
  const [clientTypeIds, setClientTypeIds] = useState<number[]>([]);
  const [addr1, setAddr1]       = useState('');
  const [addr2, setAddr2]       = useState('');
  const [cityId, setCityId]     = useState<number | null>(null);
  const [countyId, setCountyId] = useState<number | null>(null);
  const [stateId, setStateId]   = useState<number | null>(null);
  const [zip, setZip]           = useState('');
  const [notes, setNotes]       = useState('');
  const [items, setItems]       = useState<ItemLine[]>([]);
  const [err, setErr]           = useState<string | null>(null);

  function addItemLine() {
    setItems(prev => [...prev, { item_category_id: '', quantity: 1, priority: '', item_notes: '' }]);
  }
  function updateItemLine(i: number, patch: Partial<ItemLine>) {
    setItems(prev => prev.map((line, idx) => idx === i ? { ...line, ...patch } : line));
  }
  function removeItemLine(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }

  const submitMut = useMutation({
    mutationFn: () => apiPost<{ client_id: number }>('/api/agency/referrals', {
      contact: {
        first_name: first.trim(),
        last_name: last.trim(),
        email: email.trim() || null,
        mobile_phone: mobile.trim() || null,
        birth_date: dob.trim() || null,
      },
      address: {
        address: addr1.trim(),
        address2: addr2.trim() || null,
        city_id: cityId!,
        county_id: countyId!,
        state_id: stateId!,
        postalcode: zip.trim(),
      },
      client_type_ids: clientTypeIds,
      notes: notes.trim() || null,
      items: items
        .filter(i => i.item_category_id)
        .map(i => ({
          item_category_id: Number(i.item_category_id),
          quantity: i.quantity,
          priority: i.priority || null,
          item_notes: i.item_notes.trim() || null,
        })),
    }),
    onSuccess: (r) => navigate(`/agency/referrals/${r.client_id}`),
    onError: (e: any) => setErr(e.message ?? 'Submit failed'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const missing: string[] = [];
    if (!first.trim()) missing.push('First name');
    if (!last.trim())  missing.push('Last name');
    if (!addr1.trim()) missing.push('Street address');
    if (!cityId)       missing.push('City');
    if (!countyId)     missing.push('County');
    if (!stateId)      missing.push('State');
    if (!zip.trim())   missing.push('ZIP');
    if (clientTypeIds.length === 0) missing.push('Household type');
    if (missing.length) { setErr(`Required: ${missing.join(', ')}`); return; }
    submitMut.mutate();
  }

  if (!clientTypes || !cities || !counties || !states || !itemCategories) return <Loading />;

  return (
    <>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-medium m-0">Refer a household</h1>
        <p className="text-sm text-ink-soft mt-1">
          Fill out the basics — Furnish Hope will reach out to coordinate the rest.
          All fields marked <span className="text-terracotta">*</span> are required.
        </p>
      </div>

      <DedupSuggestions
        apiPath="/api/agency/clients/search"
        first_name={first}
        last_name={last}
        birth_date={dob}
        mobile_phone={mobile}
        email={email}
        onPickExisting={(c) => {
          // Agency caseworkers route to their existing referral against this
          // client. The detail path is /:client_id, not /:referral_id.
          navigate(`/agency/referrals/${c.client_id}`);
        }}
      />

      <form onSubmit={handleSubmit} className="card max-w-2xl space-y-5">

        <Section title="Head of household">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="First name" required value={first} onChange={setFirst} />
            <Field label="Last name"  required value={last}  onChange={setLast} />
            <Field label="Date of birth" type="date" value={dob} onChange={setDob} />
            <div /> {/* spacer to keep email/phone on their own row */}
            <Field label="Email" type="email" value={email} onChange={setEmail} />
            <Field label="Phone" type="tel" value={mobile} onChange={setMobile} />
          </div>
        </Section>

        <Section title="Household type" hint="Check all that apply — a household can be more than one (e.g. Veteran + Natural Disaster).">
          <CheckboxGroup
            label=""
            required
            options={clientTypes.map(t => ({ value: t.client_type_id, label: t.client_type }))}
            value={clientTypeIds}
            onChange={setClientTypeIds}
          />
        </Section>

        <Section title="Delivery address">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Field label="Street address" required value={addr1} onChange={setAddr1} placeholder="123 Main St" />
            </div>
            <div className="sm:col-span-2">
              <Field label="Apt / Unit" value={addr2} onChange={setAddr2} />
            </div>
            <div>
              <label className="field-label">City <span className="text-terracotta">*</span></label>
              <select className="field-input" value={cityId ?? ''} onChange={e => setCityId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Choose…</option>
                {cities?.map(c => <option key={c.city_id} value={c.city_id}>{c.city}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">County <span className="text-terracotta">*</span></label>
              <select className="field-input" value={countyId ?? ''} onChange={e => setCountyId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Choose…</option>
                {counties?.map(c => <option key={c.county_id} value={c.county_id}>{c.county}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">State <span className="text-terracotta">*</span></label>
              <select className="field-input" value={stateId ?? ''} onChange={e => setStateId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Choose…</option>
                {states?.map(s => <option key={s.state_id} value={s.state_id}>{s.state}</option>)}
              </select>
            </div>
            <Field label="ZIP" required value={zip} onChange={setZip} />
          </div>
        </Section>

        <Section title="What does the household need?" hint="Optional — list the furniture and household items you're requesting. Furnish Hope staff will review and may adjust before sourcing.">
          {items.length === 0 ? (
            <div className="text-sm text-ink-soft mb-2">No items added yet.</div>
          ) : (
            <div className="space-y-2 mb-2">
              {items.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end p-2 bg-cream-soft rounded">
                  <div className="col-span-12 sm:col-span-5">
                    <label className="field-label text-xs">Item</label>
                    <select
                      className="field-input"
                      value={line.item_category_id}
                      onChange={e => updateItemLine(i, { item_category_id: e.target.value ? Number(e.target.value) : '' })}
                    >
                      <option value="">Choose…</option>
                      {itemCategories.map(c => (
                        <option key={c.item_category_id} value={c.item_category_id}>{c.item_category}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <label className="field-label text-xs">Qty</label>
                    <input
                      type="number"
                      min={1}
                      className="field-input"
                      value={line.quantity}
                      onChange={e => updateItemLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <label className="field-label text-xs">Priority</label>
                    <select
                      className="field-input"
                      value={line.priority}
                      onChange={e => updateItemLine(i, { priority: e.target.value as ItemLine['priority'] })}
                    >
                      <option value="">—</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="col-span-10 sm:col-span-2">
                    <label className="field-label text-xs">Notes</label>
                    <input
                      type="text"
                      className="field-input"
                      value={line.item_notes}
                      onChange={e => updateItemLine(i, { item_notes: e.target.value })}
                      placeholder="e.g. twin size"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItemLine(i)}
                      className="text-terracotta hover:text-terracotta-deep text-sm py-2"
                      title="Remove this item"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={addItemLine}
            className="btn-ghost text-sm"
          >
            + Add item
          </button>
        </Section>

        <Section title="Notes" hint="Anything Furnish Hope should know — accessibility needs, language preference, urgency, etc.">
          <textarea
            rows={3}
            className="field-input font-sans"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </Section>

        {err && <div className="p-3 bg-terracotta-soft text-terracotta-deep rounded text-sm">{err}</div>}

        <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
          <Link to="/agency/referrals" className="btn-ghost">Cancel</Link>
          <button type="submit" disabled={submitMut.isPending} className="btn-primary disabled:opacity-60">
            {submitMut.isPending ? 'Submitting…' : 'Submit referral'}
          </button>
        </div>
      </form>
    </>
  );
}

function Field({
  label, value, onChange, type = 'text', required, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="field-label">
        {label} {required && <span className="text-terracotta">*</span>}
      </label>
      <input
        type={type}
        className="field-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <h3 className="font-display font-medium text-base">{title}</h3>
        {hint && <p className="text-[11px] text-ink-faint">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
