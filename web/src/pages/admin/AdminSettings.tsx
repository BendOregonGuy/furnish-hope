/**
 * Admin settings page. Groups the key/value rows from `tbl_app_setting`
 * into friendly sections, validates the inputs locally, and bulk-PUTs the
 * diff back to `/api/admin/settings`.
 *
 * Known keys get hand-tuned labels and input types. Any future keys
 * the server adds will appear in a fallback "Other settings" group with
 * just key + description.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '../../lib/api.ts';
import { PageHeader, Loading, ErrorBox } from '../../components/ui.tsx';
import { Section } from '../../components/forms/FormSection.tsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.ts';

interface Setting {
  setting_key: string;
  setting_value: string;
  description: string | null;
  updated_at: string;
}

interface SettingsResponse { settings: Setting[]; }

/** Friendly layout. Each known key gets a label + input variant. */
interface FieldDef {
  key: string;
  label: string;
  input?: 'text' | 'textarea' | 'number' | 'select' | 'email';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  help?: string;
}

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' },   { value: '4', label: 'April' },
  { value: '5', label: 'May' },     { value: '6', label: 'June' },
  { value: '7', label: 'July' },    { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const SECTIONS: { title: string; hint: string; fields: FieldDef[] }[] = [
  {
    title: 'Organization',
    hint: 'Appears on receipts and acknowledgement letters.',
    fields: [
      { key: 'org_name',           label: 'Organization name' },
      { key: 'org_address_line1',  label: 'Street address',  placeholder: '123 Main St' },
      { key: 'org_address_line2',  label: 'Suite / unit',    placeholder: 'Suite 200' },
      { key: 'org_city',           label: 'City' },
      { key: 'org_state',          label: 'State / region',  placeholder: 'OR' },
      { key: 'org_postalcode',     label: 'ZIP / postal code' },
      { key: 'org_phone',          label: 'Phone' },
      { key: 'org_email',          label: 'Email', input: 'email' },
      { key: 'org_ein',            label: 'Federal EIN', placeholder: 'XX-XXXXXXX',
        help: 'Required on US tax-deductible receipts. Format: 9 digits, e.g. 12-3456789.' },
    ],
  },
  {
    title: 'Fiscal year & receipts',
    hint: 'Controls how receipt numbers are generated.',
    fields: [
      { key: 'fiscal_year_start_month', label: 'Fiscal year starts in', input: 'select', options: MONTHS,
        help: 'Calendar year = January. Most US nonprofits use July; ask your accountant if unsure.' },
      { key: 'receipt_prefix', label: 'Receipt prefix', placeholder: 'FH',
        help: 'Two or three letters. Combined with fiscal year and a sequential number: PREFIX-YYYY-0001.' },
    ],
  },
  {
    title: 'Thresholds & defaults',
    hint: 'When to auto-flag donations for follow-up.',
    fields: [
      { key: 'acknowledgement_threshold', label: 'Acknowledgement letter threshold ($)', input: 'number',
        help: 'Gifts at or above this amount get a tax-deductible acknowledgement letter. IRS requires written acknowledgement for gifts of $250 or more.' },
    ],
  },
];

const KNOWN_KEYS = new Set(SECTIONS.flatMap(s => s.fields.map(f => f.key)));

export function AdminSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<SettingsResponse>({
    queryKey: ['admin', 'settings'],
    queryFn: () => apiGet('/api/admin/settings'),
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /** Snapshot incoming settings into editable state. */
  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const s of data.settings) next[s.setting_key] = s.setting_value ?? '';
    setValues(next);
    setInitial(next);
    setTopError(null);
    setSuccess(false);
  }, [data]);

  const { isDirty, safeNavigate } = useUnsavedChanges({ values, initialValues: initial });

  const settingsByKey = useMemo(() => {
    const map = new Map<string, Setting>();
    for (const s of data?.settings ?? []) map.set(s.setting_key, s);
    return map;
  }, [data]);

  /** Settings the server has that we don't have a friendly layout for. */
  const otherSettings = useMemo(
    () => (data?.settings ?? []).filter(s => !KNOWN_KEYS.has(s.setting_key)),
    [data],
  );

  const saveMut = useMutation({
    mutationFn: (changes: Record<string, string>) =>
      apiPut<SettingsResponse>('/api/admin/settings', { changes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      setSuccess(true);
      setTopError(null);
      // setInitial happens via the data effect once the query refetches
    },
    onError: (err: any) => {
      setSuccess(false);
      setTopError(err.message ?? 'Save failed');
    },
  });

  function handleChange(key: string, v: string) {
    setValues(prev => ({ ...prev, [key]: v }));
    setSuccess(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);

    // Client-side validation for known typed keys.
    const errs: string[] = [];
    const fy = values['fiscal_year_start_month'];
    if (fy && (!/^[0-9]+$/.test(fy) || Number(fy) < 1 || Number(fy) > 12)) {
      errs.push('Fiscal year start must be 1–12.');
    }
    const ack = values['acknowledgement_threshold'];
    if (ack && (Number.isNaN(Number(ack)) || Number(ack) < 0)) {
      errs.push('Acknowledgement threshold must be 0 or greater.');
    }
    const prefix = values['receipt_prefix'];
    if (prefix && !/^[A-Z0-9]+$/i.test(prefix)) {
      errs.push('Receipt prefix can only contain letters and digits.');
    }
    const ein = values['org_ein'];
    if (ein && !/^[0-9]{2}-?[0-9]{7}$/.test(ein)) {
      errs.push('EIN must be 9 digits, optionally hyphenated as XX-XXXXXXX.');
    }
    if (errs.length) {
      setTopError(errs.join(' '));
      return;
    }

    // Send only the keys that actually changed.
    const changes: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if ((initial[k] ?? '') !== (v ?? '')) changes[k] = v ?? '';
    }
    if (Object.keys(changes).length === 0) return;

    saveMut.mutate(changes);
  }

  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;

  const currentYear = new Date().getFullYear();
  const previewPrefix = (values['receipt_prefix'] || 'FH').toUpperCase();
  const receiptPreview = `${previewPrefix}-${currentYear}-0001`;

  return (
    <>
      <PageHeader
        title="Application"
        emphasis="settings"
        subtitle="Org info that appears on receipts, fiscal year for accounting, defaults for new records."
      />

      {topError && (
        <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>
      )}
      {success && !isDirty && (
        <div className="mb-5 p-3 bg-sage-soft text-[#3F4A33] rounded-md text-sm">
          Settings saved.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
        {SECTIONS.map(sec => (
          <Section key={sec.title} title={sec.title} hint={sec.hint}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {sec.fields.map(f => {
                const s = settingsByKey.get(f.key);
                const val = values[f.key] ?? '';
                const id = `setting-${f.key}`;
                return (
                  <div key={f.key}>
                    <label htmlFor={id} className="field-label">{f.label}</label>
                    {f.input === 'select' ? (
                      <select
                        id={id}
                        className="field-input"
                        value={val}
                        onChange={e => handleChange(f.key, e.target.value)}
                      >
                        {(f.options ?? []).map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : f.input === 'textarea' ? (
                      <textarea
                        id={id}
                        rows={3}
                        className="field-input"
                        value={val}
                        placeholder={f.placeholder}
                        onChange={e => handleChange(f.key, e.target.value)}
                      />
                    ) : (
                      <input
                        id={id}
                        type={f.input === 'number' ? 'number' : (f.input === 'email' ? 'email' : 'text')}
                        className="field-input"
                        value={val}
                        placeholder={f.placeholder}
                        onChange={e => handleChange(f.key, e.target.value)}
                      />
                    )}
                    {f.help && <div className="text-[11px] text-ink-faint mt-1">{f.help}</div>}
                    {s?.description && !f.help && (
                      <div className="text-[11px] text-ink-faint mt-1">{s.description}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Receipt preview lives inside the fiscal year section. */}
            {sec.title === 'Fiscal year & receipts' && (
              <div className="mt-4 pt-4 border-t border-hairline text-xs text-ink-soft">
                <span className="text-[10px] tracking-widest uppercase text-ink-faint font-medium mr-2">Next receipt will look like</span>
                <code className="font-mono bg-cream-deep px-2 py-0.5 rounded">{receiptPreview}</code>
              </div>
            )}
          </Section>
        ))}

        {otherSettings.length > 0 && (
          <Section title="Other settings" hint="Custom keys the server added; edit directly.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {otherSettings.map(s => (
                <div key={s.setting_key}>
                  <label className="field-label">
                    {s.setting_key.replace(/_/g, ' ')}
                  </label>
                  <input
                    type="text"
                    className="field-input"
                    value={values[s.setting_key] ?? ''}
                    onChange={e => handleChange(s.setting_key, e.target.value)}
                  />
                  {s.description && (
                    <div className="text-[11px] text-ink-faint mt-1">{s.description}</div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        <div className="card flex items-center justify-between gap-3">
          <div className="text-xs text-ink-faint">
            {isDirty && <span className="italic">Unsaved changes</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => safeNavigate('/admin')}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isDirty || saveMut.isPending}
              className="btn-primary disabled:opacity-60"
            >
              {saveMut.isPending ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
