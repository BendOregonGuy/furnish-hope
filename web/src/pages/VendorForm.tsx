/**
 * Create + edit form for a Vendor. Contact (first/last/email/phones) +
 * vendor metadata (type, specialty, compliance flags, payment terms,
 * notes) in a single atomic save.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost, apiPut } from '../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.ts';

interface VendorTypeRow { vendor_type_id: number; vendor_type: string }
interface VendorSpecialtyRow { vendor_specialty_id: number; vendor_specialty: string }

interface FormState {
  // Contact
  first_name: string;
  last_name: string;
  email: string;
  mobile_phone: string;
  home_phone: string;
  // Vendor
  business_name: string;
  vendor_type_id: number | '';
  vendor_specialty_id: number | '';
  w9_received: boolean;
  w9_received_date: string;
  coi_received: boolean;
  coi_expires_at: string;
  default_hourly_rate: string;
  payment_terms: string;
  tax_id: string;
  notes: string;
  is_active: boolean;
}

const initial: FormState = {
  first_name: '', last_name: '', email: '', mobile_phone: '', home_phone: '',
  business_name: '',
  vendor_type_id: '', vendor_specialty_id: '',
  w9_received: false, w9_received_date: '',
  coi_received: false, coi_expires_at: '',
  default_hourly_rate: '', payment_terms: '', tax_id: '', notes: '',
  is_active: true,
};

export function VendorForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existing, isLoading: loadingExisting } = useQuery<any>({
    queryKey: ['vendor', id],
    queryFn: () => apiGet(`/api/vendors/${id}`),
    enabled: !isNew,
  });

  const { data: types } = useQuery<VendorTypeRow[]>({
    queryKey: ['lookup', 'vendor_type'],
    queryFn: () => apiGet('/api/lookups/lkp_vendor_type'),
  });
  const { data: specialties } = useQuery<VendorSpecialtyRow[]>({
    queryKey: ['lookup', 'vendor_specialty'],
    queryFn: () => apiGet('/api/lookups/lkp_vendor_specialty'),
  });

  const [values, setValues] = useState<FormState>(initial);
  const [initialValues, setInitialValues] = useState<FormState>(initial);
  const [topError, setTopError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !existing) return;
    const v = existing.vendor;
    const next: FormState = {
      first_name: v.first_name ?? '',
      last_name: v.last_name ?? '',
      email: v.email ?? '',
      mobile_phone: v.mobile_phone ?? '',
      home_phone: v.home_phone ?? '',
      business_name: v.business_name ?? '',
      vendor_type_id: v.vendor_type_id ?? '',
      vendor_specialty_id: v.vendor_specialty_id ?? '',
      w9_received: !!v.w9_received,
      w9_received_date: v.w9_received_date?.slice(0, 10) ?? '',
      coi_received: !!v.coi_received,
      coi_expires_at: v.coi_expires_at?.slice(0, 10) ?? '',
      default_hourly_rate: v.default_hourly_rate?.toString() ?? '',
      payment_terms: v.payment_terms ?? '',
      tax_id: v.tax_id ?? '',
      notes: v.notes ?? '',
      is_active: v.is_active !== false,
    };
    setValues(next);
    setInitialValues(next);
  }, [existing, isNew]);

  const { isDirty, safeNavigate } = useUnsavedChanges({ values, initialValues });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        contact: {
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          email: values.email.trim() || null,
          mobile_phone: values.mobile_phone.trim() || null,
          home_phone: values.home_phone.trim() || null,
        },
        vendor: {
          vendor_type_id: Number(values.vendor_type_id),
          vendor_specialty_id: values.vendor_specialty_id ? Number(values.vendor_specialty_id) : null,
          business_name: values.business_name.trim() || null,
          w9_received: values.w9_received,
          w9_received_date: values.w9_received_date || null,
          coi_received: values.coi_received,
          coi_expires_at: values.coi_expires_at || null,
          default_hourly_rate: values.default_hourly_rate || null,
          payment_terms: values.payment_terms.trim() || null,
          tax_id: values.tax_id.trim() || null,
          notes: values.notes.trim() || null,
          is_active: values.is_active,
        },
      };
      return isNew
        ? apiPost<{ vendor_id: number }>('/api/vendors', payload)
        : apiPut<{ vendor_id: number }>(`/api/vendors/${id}`, payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor', String(data.vendor_id)] });
      setInitialValues(values);
      if (isNew) navigate('/vendors');
      else navigate(`/vendors/${id}`);
    },
    onError: (e: any) => setTopError(e.message ?? 'Save failed'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    const missing: string[] = [];
    if (!values.first_name.trim()) missing.push('First name');
    if (!values.last_name.trim()) missing.push('Last name');
    if (!values.vendor_type_id) missing.push('Vendor type');
    if (missing.length) { setTopError(`Required: ${missing.join(', ')}`); return; }
    saveMut.mutate();
  }

  if (!isNew && loadingExisting) return <Loading />;

  return (
    <>
      <PageHeader title={isNew ? 'New vendor' : 'Edit vendor'} emphasis="vendor" helpSection="vendors" />

      {topError && <div className="mb-4 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>}

      <form onSubmit={handleSubmit} className="card max-w-3xl space-y-5">
        {/* Person */}
        <Section title="Contact">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First name *" value={values.first_name} onChange={v => setValues(s => ({ ...s, first_name: v }))} />
            <Field label="Last name *"  value={values.last_name}  onChange={v => setValues(s => ({ ...s, last_name: v }))} />
            <Field label="Email" type="email" value={values.email} onChange={v => setValues(s => ({ ...s, email: v }))} />
            <Field label="Mobile phone" value={values.mobile_phone} onChange={v => setValues(s => ({ ...s, mobile_phone: v }))} />
            <Field label="Other phone" value={values.home_phone}   onChange={v => setValues(s => ({ ...s, home_phone: v }))} />
            <Field label="Business name (optional)" value={values.business_name} onChange={v => setValues(s => ({ ...s, business_name: v }))} placeholder="e.g. Bend Plumbing LLC" />
          </div>
        </Section>

        {/* Type + specialty */}
        <Section title="Classification">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Type *</label>
              <select className="field-input" value={values.vendor_type_id} onChange={e => setValues(s => ({ ...s, vendor_type_id: e.target.value ? Number(e.target.value) : '' }))}>
                <option value="">Choose…</option>
                {types?.map(t => <option key={t.vendor_type_id} value={t.vendor_type_id}>{t.vendor_type}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Specialty</label>
              <select className="field-input" value={values.vendor_specialty_id} onChange={e => setValues(s => ({ ...s, vendor_specialty_id: e.target.value ? Number(e.target.value) : '' }))}>
                <option value="">—</option>
                {specialties?.map(sp => <option key={sp.vendor_specialty_id} value={sp.vendor_specialty_id}>{sp.vendor_specialty}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* Compliance */}
        <Section
          title="Compliance"
          hint="Document tracking. Attach the actual paperwork in the Documents widget on the detail page after saving."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={values.w9_received} onChange={e => setValues(s => ({ ...s, w9_received: e.target.checked }))} className="w-4 h-4 accent-terracotta" />
                W-9 received
              </label>
              {values.w9_received && (
                <input type="date" className="field-input mt-2" value={values.w9_received_date} onChange={e => setValues(s => ({ ...s, w9_received_date: e.target.value }))} />
              )}
            </div>
            <div>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={values.coi_received} onChange={e => setValues(s => ({ ...s, coi_received: e.target.checked }))} className="w-4 h-4 accent-terracotta" />
                Certificate of Insurance on file
              </label>
              {values.coi_received && (
                <>
                  <input type="date" className="field-input mt-2" value={values.coi_expires_at} onChange={e => setValues(s => ({ ...s, coi_expires_at: e.target.value }))} />
                  <div className="text-[11px] text-ink-faint mt-1">Expiry date</div>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Field label="Tax ID (EIN or SSN)" value={values.tax_id} onChange={v => setValues(s => ({ ...s, tax_id: v }))} placeholder="XX-XXXXXXX" />
            <Field label="Payment terms" value={values.payment_terms} onChange={v => setValues(s => ({ ...s, payment_terms: v }))} placeholder="Net 30 / Due on receipt" />
            <Field label="Default hourly rate ($)" type="number" value={values.default_hourly_rate} onChange={v => setValues(s => ({ ...s, default_hourly_rate: v }))} placeholder="125.00" />
          </div>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <textarea
            rows={4}
            className="field-input font-sans"
            value={values.notes}
            onChange={e => setValues(s => ({ ...s, notes: e.target.value }))}
            placeholder="Internal notes — preferred contact times, quality of work, anything useful for the team to know."
          />
        </Section>

        {/* Active toggle */}
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={values.is_active} onChange={e => setValues(s => ({ ...s, is_active: e.target.checked }))} className="w-4 h-4 accent-terracotta" />
          Active vendor (uncheck to retire — hides from pickers and active-only lists)
        </label>

        {/* Save */}
        <div className="flex justify-end gap-2 pt-4 border-t border-hairline">
          <button type="button" onClick={() => safeNavigate(isNew ? '/vendors' : `/vendors/${id}`)} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={saveMut.isPending} className="btn-primary disabled:opacity-60">
            {saveMut.isPending ? 'Saving…' : (isNew ? 'Create vendor' : 'Save changes')}
          </button>
        </div>
      </form>
    </>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
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
