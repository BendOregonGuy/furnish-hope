/**
 * Public volunteer-signup form at /volunteer. No login required —
 * anyone with the URL can fill it out. Submissions land in
 * tbl_volunteer_signup with status='pending'; an admin reviews and
 * either approves (creating real volunteer records) or rejects.
 *
 * Form is intentionally chunked into clear sections so it doesn't
 * feel like a wall of fields on mobile. The honeypot field
 * (name="website") is invisible to humans but tempting to bots —
 * the server silently drops submissions where it's filled.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api.ts';

interface StateRow { state_id: number; state: string }
interface HeardFromRow { howtheyfoundus_id: number; howtheyfoundus: string }
interface OrgInfo { org_name: string; has_logo: boolean; logo_updated_at: string | null }

type Frequency = 'one_time' | 'recurring' | 'on_call';
type LiftCapacity = 'under_25' | '25_50' | '50_plus' | 'cannot';

export function VolunteerSignup() {
  // We rely on the global ScrollToTop wired into App.tsx, but the
  // form is long enough that we also scroll to top on mount.
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Org name + logo for letterhead. Public endpoint, no auth needed.
  const { data: org } = useQuery<OrgInfo>({
    queryKey: ['org-info-public'],
    queryFn: () => fetch('/api/org-info').then(r => r.ok ? r.json() : { org_name: 'Furnish Hope' }),
    retry: false,
  });

  // Lookups for the state + heard-from dropdowns. These endpoints
  // require login, so on the public page they'll fail — fall back
  // to a free-text state input if so.
  const { data: states, isError: statesErr } = useQuery<StateRow[]>({
    queryKey: ['public-states'],
    queryFn: () => apiGet('/api/lookups/lkp_state'),
    retry: false,
  });
  const { data: heardFrom } = useQuery<HeardFromRow[]>({
    queryKey: ['public-heard-from'],
    queryFn: () => apiGet('/api/lookups/lkp_howtheyfoundus'),
    retry: false,
  });

  // ----- form state -----
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [stateId, setStateId] = useState<number | null>(null);
  const [stateText, setStateText] = useState('');
  const [postal, setPostal] = useState('');
  const [dob, setDob] = useState('');
  const [emergName, setEmergName] = useState('');
  const [emergPhone, setEmergPhone] = useState('');
  const [frequency, setFrequency] = useState<Frequency | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [avail, setAvail] = useState({ mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false });
  const [tod, setTod] = useState({ morning: false, afternoon: false, evening: false });
  const [acts, setActs] = useState({
    pickups: false, deliveries: false, warehouse: false, events: false,
    admin: false, photography: false, trades: false, anywhere: false,
  });
  const [canLift, setCanLift] = useState<LiftCapacity | ''>('');
  const [hasLicense, setHasLicense] = useState(false);
  const [hasVehicle, setHasVehicle] = useState(false);
  const [skills, setSkills] = useState('');
  const [heardFromId, setHeardFromId] = useState<number | null>(null);
  const [why, setWhy] = useState('');
  const [needsHours, setNeedsHours] = useState(false);
  const [agreedWaiver, setAgreedWaiver] = useState(false);
  const [agreedEmails, setAgreedEmails] = useState(true);
  // honeypot — invisible to humans
  const [website, setWebsite] = useState('');

  const [topError, setTopError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/volunteer-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website,
          first_name: firstName, last_name: lastName,
          email, mobile_phone: phone,
          city: city || null,
          state_id: stateId ?? null,
          postalcode: postal || null,
          date_of_birth: dob || null,
          emergency_contact_name: emergName || null,
          emergency_contact_phone: emergPhone || null,
          frequency,
          start_date: startDate || null,
          end_date: endDate || null,
          avail_mon: avail.mon, avail_tue: avail.tue, avail_wed: avail.wed, avail_thu: avail.thu,
          avail_fri: avail.fri, avail_sat: avail.sat, avail_sun: avail.sun,
          time_morning: tod.morning, time_afternoon: tod.afternoon, time_evening: tod.evening,
          act_pickups: acts.pickups, act_deliveries: acts.deliveries, act_warehouse: acts.warehouse,
          act_events: acts.events, act_admin: acts.admin, act_photography: acts.photography,
          act_trades: acts.trades, act_anywhere: acts.anywhere,
          can_lift: canLift,
          has_drivers_license: hasLicense, has_vehicle: hasVehicle,
          special_skills: skills || null,
          heard_from_id: heardFromId ?? null,
          why_interested: why || null,
          needs_verified_hours: needsHours,
          agreed_to_waiver: agreedWaiver,
          agreed_to_emails: agreedEmails,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `${r.status} ${r.statusText}`);
      }
      return r.json() as Promise<{ signup_id: number }>;
    },
    onSuccess: (data) => { setSubmittedId(data.signup_id); setTopError(null); },
    onError: (e: any) => setTopError(e.message ?? 'Submit failed'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    const missing: string[] = [];
    if (!firstName.trim()) missing.push('First name');
    if (!lastName.trim())  missing.push('Last name');
    if (!email.trim())     missing.push('Email');
    if (!phone.trim())     missing.push('Mobile phone');
    if (!frequency)        missing.push('How often');
    if (!canLift)          missing.push('Lifting capacity');
    if (!agreedWaiver)     missing.push('Volunteer agreement');
    if (missing.length) { setTopError(`Please fill in: ${missing.join(', ')}`); return; }
    submit.mutate();
  }

  const orgName = org?.org_name ?? 'Furnish Hope';
  const logoUrl = org?.has_logo && org?.logo_updated_at
    ? `/api/org-info/logo?v=${encodeURIComponent(org.logo_updated_at)}`
    : null;

  // Success view — replace the form with a thank-you once submitted.
  if (submittedId) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-10">
        <div className="bg-paper border border-hairline rounded-lg shadow-sm p-8 max-w-xl w-full text-center">
          {logoUrl && <img src={logoUrl} alt="" className="h-12 mx-auto mb-4" />}
          <div className="text-3xl font-display text-terracotta mb-2">Thank you!</div>
          <div className="text-base text-ink mb-4">
            Your application has been received. We'll be in touch within 3 business days
            to coordinate next steps.
          </div>
          <div className="text-xs text-ink-faint">Confirmation #{submittedId}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-8">
          {logoUrl && <img src={logoUrl} alt="" className="h-14 mx-auto mb-4" />}
          <h1 className="font-display text-3xl font-medium m-0">Volunteer with {orgName}</h1>
          <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
            Tell us a bit about yourself and how you'd like to help. We'll review your application
            and reach out within 3 business days. Required fields marked <span className="text-terracotta">*</span>.
          </p>
        </header>

        {topError && (
          <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">
            {topError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-paper border border-hairline rounded-lg p-6 space-y-6">

          {/* honeypot */}
          <div style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }} aria-hidden>
            <label>Website (leave blank)
              <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
            </label>
          </div>

          <Section title="Your info">
            <Row>
              <Field label="First name" required>
                <input type="text" className="field-input" value={firstName} onChange={e => setFirstName(e.target.value)} required />
              </Field>
              <Field label="Last name" required>
                <input type="text" className="field-input" value={lastName} onChange={e => setLastName(e.target.value)} required />
              </Field>
            </Row>
            <Row>
              <Field label="Email" required>
                <input type="email" className="field-input" value={email} onChange={e => setEmail(e.target.value)} required />
              </Field>
              <Field label="Mobile phone" required>
                <input type="tel" className="field-input" value={phone} onChange={e => setPhone(e.target.value)} required />
              </Field>
            </Row>
            <Row>
              <Field label="City">
                <input type="text" className="field-input" value={city} onChange={e => setCity(e.target.value)} />
              </Field>
              <Field label="State">
                {states && !statesErr ? (
                  <select className="field-input" value={stateId ?? ''} onChange={e => setStateId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">—</option>
                    {states.map(s => <option key={s.state_id} value={s.state_id}>{s.state}</option>)}
                  </select>
                ) : (
                  <input type="text" className="field-input" placeholder="e.g., Oregon" value={stateText} onChange={e => setStateText(e.target.value)} />
                )}
              </Field>
              <Field label="ZIP">
                <input type="text" className="field-input" value={postal} onChange={e => setPostal(e.target.value)} maxLength={10} />
              </Field>
            </Row>
            <Row>
              <Field label="Date of birth (helps with under-18 procedures)">
                <input type="date" className="field-input" value={dob} onChange={e => setDob(e.target.value)} />
              </Field>
            </Row>
            <Row>
              <Field label="Emergency contact name">
                <input type="text" className="field-input" value={emergName} onChange={e => setEmergName(e.target.value)} />
              </Field>
              <Field label="Emergency contact phone">
                <input type="tel" className="field-input" value={emergPhone} onChange={e => setEmergPhone(e.target.value)} />
              </Field>
            </Row>
          </Section>

          <Section title="How often can you help?" hint="Pick one — we use it to assign you to the right kind of work.">
            <div className="flex flex-col gap-2">
              <RadioRow checked={frequency === 'one_time'}  onClick={() => setFrequency('one_time')}  label="One-time" hint="A single event or shift — no ongoing commitment." />
              <RadioRow checked={frequency === 'recurring'} onClick={() => setFrequency('recurring')} label="Recurring" hint="Regular involvement — weekly or biweekly works great for us." />
              <RadioRow checked={frequency === 'on_call'}   onClick={() => setFrequency('on_call')}   label="Call me when you need extra hands" hint="Sporadic, when you're available." />
            </div>
            {(frequency === 'recurring' || frequency === 'on_call') && (
              <Row>
                <Field label="Earliest start date">
                  <input type="date" className="field-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </Field>
                <Field label="End date (optional)">
                  <input type="date" className="field-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </Field>
              </Row>
            )}
          </Section>

          <Section title="What kind of work?" hint="Pick anything that interests you — we'll match where you fit best.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <CheckRow checked={acts.pickups}     onClick={() => setActs(p => ({ ...p, pickups: !p.pickups }))}       label="Donation pickups" hint="driving + carrying" />
              <CheckRow checked={acts.deliveries}  onClick={() => setActs(p => ({ ...p, deliveries: !p.deliveries }))} label="Furniture delivery" hint="driving + carrying + assembly" />
              <CheckRow checked={acts.warehouse}   onClick={() => setActs(p => ({ ...p, warehouse: !p.warehouse }))}   label="Warehouse sorting & organizing" />
              <CheckRow checked={acts.events}      onClick={() => setActs(p => ({ ...p, events: !p.events }))}         label="Event support" hint="galas, awareness events" />
              <CheckRow checked={acts.admin}       onClick={() => setActs(p => ({ ...p, admin: !p.admin }))}           label="Administrative / data entry" />
              <CheckRow checked={acts.photography} onClick={() => setActs(p => ({ ...p, photography: !p.photography }))} label="Photography / social media" />
              <CheckRow checked={acts.trades}      onClick={() => setActs(p => ({ ...p, trades: !p.trades }))}         label="Specialized trades" hint="carpentry, electrical, refinishing" />
              <CheckRow checked={acts.anywhere}    onClick={() => setActs(p => ({ ...p, anywhere: !p.anywhere }))}     label="Wherever you need me" />
            </div>
          </Section>

          <Section title="When are you available?" hint="Check any that apply — we work around your schedule.">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-1.5">Days of the week</div>
              <div className="flex gap-2 flex-wrap">
                {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map(d => (
                  <button key={d} type="button"
                    onClick={() => setAvail(p => ({ ...p, [d]: !p[d] }))}
                    className={`px-3 py-2 text-xs rounded border ${avail[d] ? 'bg-terracotta text-paper border-terracotta' : 'bg-paper text-ink-soft border-hairline-strong'}`}>
                    {d[0].toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-widest text-ink-faint font-medium mb-1.5">Time of day</div>
              <div className="flex gap-2 flex-wrap">
                {(['morning', 'afternoon', 'evening'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setTod(p => ({ ...p, [t]: !p[t] }))}
                    className={`px-4 py-2 text-xs rounded border ${tod[t] ? 'bg-sage text-paper border-sage' : 'bg-paper text-ink-soft border-hairline-strong'}`}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <Section title="What do you bring?">
            <Field label="Can you lift?" required>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([['under_25', 'Under 25 lbs'], ['25_50', '25–50 lbs'], ['50_plus', '50+ lbs'], ['cannot', "I can't lift"]] as const).map(([v, l]) => (
                  <button key={v} type="button"
                    onClick={() => setCanLift(v)}
                    className={`px-3 py-2 text-xs rounded border ${canLift === v ? 'bg-terracotta text-paper border-terracotta' : 'bg-paper text-ink-soft border-hairline-strong'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>
            <Row>
              <CheckRow checked={hasLicense} onClick={() => setHasLicense(!hasLicense)} label="I have a valid driver's license" />
              <CheckRow checked={hasVehicle} onClick={() => setHasVehicle(!hasVehicle)} label="I have access to a vehicle" />
            </Row>
            <Field label="Special skills or notes" hint="e.g., 'I'm a licensed electrician', 'I speak Spanish', 'I have a pickup truck'">
              <textarea rows={2} className="field-input font-sans" value={skills} onChange={e => setSkills(e.target.value)} />
            </Field>
          </Section>

          <Section title="About you">
            <Field label="How did you hear about us?">
              {heardFrom ? (
                <select className="field-input" value={heardFromId ?? ''} onChange={e => setHeardFromId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">—</option>
                  {heardFrom.map(h => <option key={h.howtheyfoundus_id} value={h.howtheyfoundus_id}>{h.howtheyfoundus}</option>)}
                </select>
              ) : (
                <input type="text" className="field-input" placeholder="word of mouth, social media, etc." />
              )}
            </Field>
            <Field label="Why are you interested?" hint="A sentence or two is plenty.">
              <textarea rows={3} className="field-input font-sans" value={why} onChange={e => setWhy(e.target.value)} />
            </Field>
            <CheckRow checked={needsHours} onClick={() => setNeedsHours(!needsHours)} label="I need verified volunteer hours (for school, court, or work)" />
          </Section>

          <Section title="Agreements" required>
            <CheckRow checked={agreedWaiver} onClick={() => setAgreedWaiver(!agreedWaiver)}
              label="I agree to the volunteer agreement and liability release" required />
            <CheckRow checked={agreedEmails} onClick={() => setAgreedEmails(!agreedEmails)}
              label={`I'm OK with ${orgName} emailing me about scheduling and updates`} />
          </Section>

          <div className="pt-3 border-t border-hairline flex items-center justify-between gap-3">
            <div className="text-xs text-ink-faint">We'll be in touch within 3 business days.</div>
            <button type="submit" disabled={submit.isPending} className="btn-primary disabled:opacity-60">
              {submit.isPending ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* --- small layout helpers, scoped to this page --- */

function Section({ title, hint, required, children }: { title: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="font-display font-medium text-base m-0">
          {title}{required && <span className="text-terracotta ml-1">*</span>}
        </h3>
        {hint && <p className="text-[11px] text-ink-faint mt-0.5">{hint}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">
        {label} {required && <span className="text-terracotta">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-ink-faint mt-1">{hint}</p>}
    </div>
  );
}

function RadioRow({ checked, onClick, label, hint }: { checked: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-left px-3 py-2.5 rounded border ${checked ? 'border-terracotta bg-terracotta-soft/40' : 'border-hairline-strong bg-paper hover:bg-cream'}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-block w-3 h-3 rounded-full border ${checked ? 'border-terracotta bg-terracotta' : 'border-hairline-strong'}`} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      {hint && <div className="text-[11px] text-ink-faint mt-0.5 pl-5">{hint}</div>}
    </button>
  );
}

function CheckRow({ checked, onClick, label, hint, required }: { checked: boolean; onClick: () => void; label: string; hint?: string; required?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-left px-3 py-2 rounded border ${checked ? 'border-sage bg-sage-soft/50' : 'border-hairline-strong bg-paper hover:bg-cream'}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-block w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-paper ${checked ? 'border-sage bg-sage' : 'border-hairline-strong'}`}>
          {checked ? '✓' : ''}
        </span>
        <span className="text-sm">
          {label}{required && <span className="text-terracotta ml-1">*</span>}
        </span>
      </div>
      {hint && <div className="text-[11px] text-ink-faint mt-0.5 pl-5">{hint}</div>}
    </button>
  );
}
