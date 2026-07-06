/**
 * Public agency-partner application form. Anyone (no login) fills it out
 * to apply to become a Furnish Hope referring partner. Once submitted a
 * Program Manager reviews it; on approval the system emails the listed
 * caseworkers registration links.
 *
 * Uses the public /api/public/* endpoints — no auth cookies required.
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '../lib/api.ts';
import { Loading } from '../components/ui.tsx';
import { CheckboxGroup } from '../components/CheckboxGroup.tsx';

interface LookupRow { id: number; label: string }

interface Caseworker {
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phone: string;
}

function blankCaseworker(): Caseworker {
  return { first_name: '', last_name: '', title: '', email: '', phone: '' };
}

export function ApplyToRefer() {
  const [step, setStep] = useState<'form' | 'done'>('form');

  const { data: clientTypes } = useQuery<LookupRow[]>({
    queryKey: ['public-lookup', 'client_type'],
    queryFn: () => apiGet('/api/public/lookups/client_type'),
    staleTime: 5 * 60_000,
  });
  const { data: states } = useQuery<LookupRow[]>({
    queryKey: ['public-lookup', 'state'],
    queryFn: () => apiGet('/api/public/lookups/state'),
    staleTime: 5 * 60_000,
  });

  // Agency identity
  const [agencyName, setAgencyName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [ein, setEin] = useState('');
  const [website, setWebsite] = useState('');
  const [mainPhone, setMainPhone] = useState('');
  const [mainEmail, setMainEmail] = useState('');

  // Address
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [zip, setZip] = useState('');
  const [serviceArea, setServiceArea] = useState('');

  // Program
  const [publicDescription, setPublicDescription] = useState('');
  const [needsFilled, setNeedsFilled] = useState('');
  const [approxClients, setApproxClients] = useState('');
  const [edName, setEdName] = useState('');
  const [otherInfo, setOtherInfo] = useState('');

  // Populations + caseworkers
  const [clientTypeIds, setClientTypeIds] = useState<number[]>([]);
  const [caseworkers, setCaseworkers] = useState<Caseworker[]>([blankCaseworker()]);

  // Honeypot: invisible field bots fill, humans don't. Named unlike
  // any real field to avoid password managers auto-filling.
  const [companySlogan, setCompanySlogan] = useState('');

  const [err, setErr] = useState<string | null>(null);

  const submitMut = useMutation({
    mutationFn: () => apiPost<{ agency_application_id: number }>(
      '/api/public/agency-applications',
      {
        company_slogan: companySlogan,
        agency_name: agencyName.trim(),
        legal_name: legalName.trim() || null,
        ein: ein.trim() || null,
        website: website.trim() || null,
        main_phone: mainPhone.trim() || null,
        main_email: mainEmail.trim(),
        address_line1: addr1.trim(),
        address_line2: addr2.trim() || null,
        city: city.trim(),
        state: stateName.trim(),
        postalcode: zip.trim(),
        service_area: serviceArea.trim() || null,
        public_description: publicDescription.trim() || null,
        needs_filled: needsFilled.trim() || null,
        approx_clients_per_month: approxClients ? Number(approxClients) : null,
        executive_director_name: edName.trim() || null,
        other_info: otherInfo.trim() || null,
        client_type_ids: clientTypeIds,
        caseworkers: caseworkers
          .filter(c => c.first_name.trim() || c.last_name.trim() || c.email.trim())
          .map(c => ({
            first_name: c.first_name,
            last_name: c.last_name,
            title: c.title || null,
            email: c.email,
            phone: c.phone || null,
          })),
      },
    ),
    onSuccess: () => setStep('done'),
    onError: (e: any) => setErr(e.message ?? 'Submit failed'),
  });

  function updateCw(i: number, patch: Partial<Caseworker>) {
    setCaseworkers(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }
  function addCw() {
    setCaseworkers(prev => [...prev, blankCaseworker()]);
  }
  function removeCw(i: number) {
    setCaseworkers(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const missing: string[] = [];
    if (!agencyName.trim())          missing.push('Agency name');
    if (!mainEmail.trim())           missing.push('Main email');
    if (!addr1.trim())               missing.push('Street address');
    if (!city.trim())                missing.push('City');
    if (!stateName.trim())           missing.push('State');
    if (!zip.trim())                 missing.push('ZIP');
    if (clientTypeIds.length === 0)  missing.push('At least one population served');
    const validCws = caseworkers.filter(c => c.first_name.trim() && c.last_name.trim() && c.email.trim());
    if (validCws.length === 0)       missing.push('At least one caseworker');
    if (missing.length) { setErr(`Please fill in: ${missing.join(', ')}`); return; }
    submitMut.mutate();
  }

  if (!clientTypes || !states) return <Loading />;

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-paper py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 rounded-full bg-sage-soft flex items-center justify-center mx-auto mb-6">
            <div className="text-3xl text-sage-deep">✓</div>
          </div>
          <h1 className="font-display text-3xl font-medium mb-3">Thank you!</h1>
          <p className="text-ink-soft mb-2">
            Your application has been received. A Furnish Hope Program Manager
            will review it in the next few days.
          </p>
          <p className="text-ink-soft">
            Once approved, we'll send a personal invitation email to each
            caseworker on your list so they can create their own login and
            start referring families right away.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-medium">Apply to refer households</h1>
          <p className="text-ink-soft mt-2">
            Tell us about your agency and the caseworkers who'll be sending
            referrals. Fields marked <span className="text-terracotta">*</span> are required.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="card space-y-6">
          {/* Honeypot — off-screen, no label, bots fill it */}
          <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={companySlogan}
              onChange={e => setCompanySlogan(e.target.value)}
              placeholder="Slogan"
            />
          </div>

          <Section title="Your agency" hint="The basics we need to reach you.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Agency name" required value={agencyName} onChange={setAgencyName} />
              <Field label="Legal name" value={legalName} onChange={setLegalName} hint="If different from the working name." />
              <Field label="EIN" value={ein} onChange={setEin} />
              <Field label="Website" value={website} onChange={setWebsite} placeholder="https://..." />
              <Field label="Main phone" type="tel" value={mainPhone} onChange={setMainPhone} />
              <Field label="Main email" required type="email" value={mainEmail} onChange={setMainEmail} />
            </div>
          </Section>

          <Section title="Address">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Field label="Street address" required value={addr1} onChange={setAddr1} />
              </div>
              <div className="sm:col-span-2">
                <Field label="Suite / unit" value={addr2} onChange={setAddr2} />
              </div>
              <Field label="City" required value={city} onChange={setCity} />
              <div>
                <label className="field-label">State <span className="text-terracotta">*</span></label>
                <select className="field-input" value={stateName} onChange={e => setStateName(e.target.value)}>
                  <option value="">Choose…</option>
                  {states.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
                </select>
              </div>
              <Field label="ZIP" required value={zip} onChange={setZip} />
              <Field label="Service area" value={serviceArea} onChange={setServiceArea} placeholder="e.g. Deschutes + Crook counties" />
            </div>
          </Section>

          <Section title="Populations you serve" hint="Check all that apply. This drives our matching and is shown on the /referring-agencies page.">
            <CheckboxGroup
              label=""
              required
              options={clientTypes.map(t => ({ value: t.id, label: t.label }))}
              value={clientTypeIds}
              onChange={setClientTypeIds}
            />
          </Section>

          <Section title="Your program" hint="Help us understand what you do and how we can help.">
            <div className="space-y-3">
              <div>
                <label className="field-label">Short description</label>
                <textarea rows={2} className="field-input font-sans" value={publicDescription} onChange={e => setPublicDescription(e.target.value)} maxLength={300} placeholder="One or two sentences to show on the /referring-agencies page. Up to 300 characters." />
              </div>
              <div>
                <label className="field-label">Needs typically filled by FH referrals</label>
                <textarea rows={3} className="field-input font-sans" value={needsFilled} onChange={e => setNeedsFilled(e.target.value)} placeholder="Beds, dining sets, kitchen kits — whatever your households usually need." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Approx clients / month" type="number" value={approxClients} onChange={setApproxClients} placeholder="e.g. 12" />
                <Field label="Executive Director" value={edName} onChange={setEdName} />
              </div>
              <div>
                <label className="field-label">Anything else we should know?</label>
                <textarea rows={3} className="field-input font-sans" value={otherInfo} onChange={e => setOtherInfo(e.target.value)} />
              </div>
            </div>
          </Section>

          <Section title="Caseworkers" hint="Once approved, each caseworker gets an emailed invitation to create their FH portal login.">
            <div className="space-y-3">
              {caseworkers.map((cw, i) => (
                <div key={i} className="p-3 bg-cream-soft rounded border border-hairline">
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-xs font-medium text-ink-soft uppercase tracking-widest">Caseworker {i + 1}</div>
                    {caseworkers.length > 1 && (
                      <button type="button" onClick={() => removeCw(i)} className="text-xs text-terracotta hover:text-terracotta-deep">Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field label="First name" required value={cw.first_name} onChange={v => updateCw(i, { first_name: v })} />
                    <Field label="Last name"  required value={cw.last_name}  onChange={v => updateCw(i, { last_name: v })} />
                    <Field label="Title" value={cw.title} onChange={v => updateCw(i, { title: v })} placeholder="e.g. Case Manager" />
                    <Field label="Phone" type="tel" value={cw.phone} onChange={v => updateCw(i, { phone: v })} />
                    <div className="sm:col-span-2">
                      <Field label="Email" required type="email" value={cw.email} onChange={v => updateCw(i, { email: v })} />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addCw} className="btn-ghost text-sm">+ Add another caseworker</button>
            </div>
          </Section>

          {err && (
            <div className="p-3 bg-terracotta-soft text-terracotta-deep rounded text-sm">{err}</div>
          )}

          <div className="flex justify-end pt-3 border-t border-hairline">
            <button type="submit" disabled={submitMut.isPending} className="btn-primary disabled:opacity-60">
              {submitMut.isPending ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- small helpers ---------- */

function Field({
  label, value, onChange, type = 'text', required, placeholder, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
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
      {hint && <div className="text-[11px] text-ink-faint mt-0.5">{hint}</div>}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <h3 className="font-display font-medium text-lg">{title}</h3>
        {hint && <p className="text-xs text-ink-faint">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
