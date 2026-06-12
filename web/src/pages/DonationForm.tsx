/**
 * Create + edit form for a financial donation. Multi-section, type-aware
 * (securities / check sub-records appear when relevant), and supports
 * inline designation splits whose amounts must sum to the gift total.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api.ts';
import type { ColumnMeta } from '../lib/admin.ts';
import { validateForm, type FormErrors } from '../lib/adminValidate.ts';
import { PageHeader, Loading, ErrorBox } from '../components/ui.tsx';
import { Field } from '../components/admin/Field.tsx';
import { FkSelect } from '../components/admin/FkSelect.tsx';
import { FkCreateField } from '../components/admin/FkSelectWithCreate.tsx';
import { DonorQuickCreateModal } from '../components/donor/DonorQuickCreateModal.tsx';
import { ContactQuickCreateModal } from '../components/quickCreate/ContactQuickCreateModal.tsx';
import { PledgeQuickCreateModal } from '../components/quickCreate/PledgeQuickCreateModal.tsx';
import { CampaignQuickCreateModal } from '../components/quickCreate/CampaignQuickCreateModal.tsx';
import { FormNavBar } from '../components/forms/FormNavBar.tsx';
import { Section, FieldGrid, Cell } from '../components/forms/FormSection.tsx';
import { SubformList, type SubformRow } from '../components/forms/SubformList.tsx';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.ts';

/* ----------------------------------------------------------------- */
/*  Field configs                                                     */
/* ----------------------------------------------------------------- */

const DONOR_FIELDS: ColumnMeta[] = [
  { name: 'donor_id', label: 'Donor', type: 'fk', required: true, isPk: false, isFk: true, fkTable: 'tbl_donor' },
  { name: 'soft_credit_contact_id', label: 'Soft credit', type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'tbl_contact',
    helpText: 'When the gift is from a DAF or employer match, credit the underlying individual.' },
];

const GIFT_FIELDS: ColumnMeta[] = [
  { name: 'donation_type_id', label: 'Donation type', type: 'fk', required: true, isPk: false, isFk: true, fkTable: 'lkp_donation_type',
    helpText: 'Stock / Bond reveals security details. Monetary covers cash, check, credit card, etc.' },
  { name: 'donation_date', label: 'Gift date', type: 'date', required: true, isPk: false, isFk: false },
  { name: 'payment_method_id', label: 'Payment method', type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'lkp_payment_method',
    helpText: 'Choose "Check" to reveal check-number fields.' },
  { name: 'solicitation_method_id', label: 'Solicitation method', type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'lkp_solicitation_method',
    helpText: 'How was the gift asked for? Useful for campaign attribution.' },
  { name: 'total_value', label: 'Gift amount ($)', type: 'money', required: true, isPk: false, isFk: false, scale: 2 },
  { name: 'tax_deductible_amount', label: 'Tax-deductible amount ($)', type: 'money', required: false, isPk: false, isFk: false, scale: 2,
    helpText: 'Defaults to the gift amount. Lower this if the donor received goods/services (gala tickets, etc.).' },
];

const SECURITIES_FIELDS: ColumnMeta[] = [
  { name: 'security_type', label: 'Security type', type: 'text', required: true, isPk: false, isFk: false, maxLength: 20, helpText: 'Stock, Bond, or Other' },
  { name: 'ticker', label: 'Ticker', type: 'text', required: false, isPk: false, isFk: false, maxLength: 20 },
  { name: 'security_description', label: 'Description', type: 'text', required: false, isPk: false, isFk: false, maxLength: 200 },
  { name: 'shares', label: 'Shares', type: 'number', required: false, isPk: false, isFk: false },
  { name: 'gift_date_fmv', label: 'Gift-date FMV ($)', type: 'money', required: false, isPk: false, isFk: false, scale: 2 },
  { name: 'sale_proceeds', label: 'Sale proceeds ($)', type: 'money', required: false, isPk: false, isFk: false, scale: 2, helpText: 'Set once we sell the security.' },
  { name: 'broker_name', label: 'Broker', type: 'text', required: false, isPk: false, isFk: false, maxLength: 100 },
];

const CHECK_FIELDS: ColumnMeta[] = [
  { name: 'check_number', label: 'Check #', type: 'text', required: false, isPk: false, isFk: false, maxLength: 20 },
  { name: 'check_date',   label: 'Check date', type: 'date', required: false, isPk: false, isFk: false },
  { name: 'bank_name',    label: 'Bank', type: 'text', required: false, isPk: false, isFk: false, maxLength: 100 },
];

const PLEDGE_FIELDS: ColumnMeta[] = [
  { name: 'pledge_id', label: 'Applies to pledge', type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'tbl_pledge',
    helpText: `Link this payment to a prior commitment; saving will recompute the pledge's remaining balance.` },
];

const ACK_FIELDS: ColumnMeta[] = [
  { name: 'acknowledgement_status_id', label: 'Acknowledgement status', type: 'fk', required: false, isPk: false, isFk: true, fkTable: 'lkp_acknowledgement_status' },
  { name: 'acknowledgement_sent_date', label: 'Acknowledgement sent', type: 'date', required: false, isPk: false, isFk: false },
];

const MISC_FIELDS: ColumnMeta[] = [
  { name: 'gift_in_honor_of', label: 'In honor of / memorial', type: 'text', required: false, isPk: false, isFk: false, maxLength: 200 },
  { name: 'received_via', label: 'Received via', type: 'text', required: false, isPk: false, isFk: false, maxLength: 50,
    helpText: 'e.g. Stripe, Givebutter, mail, in-person' },
  { name: 'external_transaction_id', label: 'External transaction ID', type: 'text', required: false, isPk: false, isFk: false, maxLength: 100,
    helpText: 'Stripe charge id / Givebutter id / bank reference — used for reconciliation.' },
  { name: 'description', label: 'Internal notes', type: 'textarea', required: false, isPk: false, isFk: false, maxLength: 100 },
];

const ALL_FIELDS = [...DONOR_FIELDS, ...GIFT_FIELDS, ...PLEDGE_FIELDS, ...ACK_FIELDS, ...MISC_FIELDS];

interface DesignationRow extends SubformRow {
  donation_designation_id?: number | null;
  fund_id: number | null;
  amount: number | string;
  description: string | null;
}

interface DonationDetailResponse {
  donation: any;
  designations: any[];
  securities: any | null;
  check: any | null;
  prevId: number | null;
  nextId: number | null;
}

interface LookupOption { id: number; label: string; }

/* ----------------------------------------------------------------- */
/*  Component                                                         */
/* ----------------------------------------------------------------- */

export function DonationForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* Look up the donation type + payment method labels so we can drive
     section visibility from the friendly names. */
  const { data: typeOptions } = useQuery<LookupOption[]>({
    queryKey: ['admin', 'fk', 'lkp_donation_type'],
    queryFn: () => apiGet('/api/admin/fk-options/lkp_donation_type'),
  });
  const { data: methodOptions } = useQuery<LookupOption[]>({
    queryKey: ['admin', 'fk', 'lkp_payment_method'],
    queryFn: () => apiGet('/api/admin/fk-options/lkp_payment_method'),
  });
  const typeLabel = useMemo(() => idLabelMap(typeOptions), [typeOptions]);
  const methodLabel = useMemo(() => idLabelMap(methodOptions), [methodOptions]);

  const { data: existing, isLoading, error: loadError } = useQuery<DonationDetailResponse>({
    queryKey: ['donation', id],
    queryFn: () => apiGet(`/api/donations/${id}`),
    enabled: !isNew,
  });

  /* Form state */
  const [values, setValues] = useState<Record<string, any>>(() => blankForm());
  const [initial, setInitial] = useState<Record<string, any>>(() => blankForm());
  const [designations, setDesignations] = useState<DesignationRow[]>([]);
  const [initialDesignations, setInitialDesignations] = useState<DesignationRow[]>([]);
  const [securities, setSecurities] = useState<Record<string, any> | null>(null);
  const [initialSecurities, setInitialSecurities] = useState<Record<string, any> | null>(null);
  const [check, setCheck] = useState<Record<string, any> | null>(null);
  const [initialCheck, setInitialCheck] = useState<Record<string, any> | null>(null);
  const [assignReceipt, setAssignReceipt] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<number | null>(null);

  /* Populate */
  useEffect(() => {
    setSubmitAttempted(false); setErrors({}); setTopError(null);
    if (isNew) {
      const blank = blankForm();
      blank.donation_date = todayIso();
      setValues(blank); setInitial(blank);
      setDesignations([]); setInitialDesignations([]);
      setSecurities(null); setInitialSecurities(null);
      setCheck(null); setInitialCheck(null);
      setAssignReceipt(true);
      return;
    }
    if (!existing) return;
    const d = existing.donation;
    const v: Record<string, any> = {
      donor_id: d.donor_id,
      soft_credit_contact_id: d.soft_credit_contact_id,
      donation_type_id: d.donation_type_id,
      donation_date: dateOnly(d.donation_date),
      payment_method_id: d.payment_method_id,
      solicitation_method_id: d.solicitation_method_id,
      total_value: d.total_value,
      tax_deductible_amount: d.tax_deductible_amount,
      pledge_id: d.pledge_id,
      acknowledgement_status_id: d.acknowledgement_status_id,
      acknowledgement_sent_date: dateOnly(d.acknowledgement_sent_date),
      gift_in_honor_of: d.gift_in_honor_of ?? '',
      received_via: d.received_via ?? '',
      external_transaction_id: d.external_transaction_id ?? '',
      description: d.description ?? '',
    };
    setValues(v); setInitial(v);
    const desigs: DesignationRow[] = (existing.designations ?? []).map((x: any) => ({
      donation_designation_id: x.donation_designation_id,
      fund_id: x.fund_id,
      amount: x.amount,
      description: x.description ?? '',
    }));
    setDesignations(desigs); setInitialDesignations(desigs);
    setSecurities(existing.securities ? { ...existing.securities } : null);
    setInitialSecurities(existing.securities ? { ...existing.securities } : null);
    setCheck(existing.check ? { ...existing.check, check_date: dateOnly(existing.check.check_date) } : null);
    setInitialCheck(existing.check ? { ...existing.check, check_date: dateOnly(existing.check.check_date) } : null);
    setAssignReceipt(false); // existing edit — don't try to reassign
  }, [existing, isNew]);

  /* Show/hide type-specific sections based on the chosen type / method. */
  const currentType = typeLabel.get(Number(values.donation_type_id) || 0);
  const currentMethod = methodLabel.get(Number(values.payment_method_id) || 0);
  const isSecuritiesType = currentType === 'Stock' || currentType === 'Bond';
  const isCheckMethod = currentMethod === 'Check';

  // Auto-attach a securities/check object when the relevant type/method is
  // picked, and remove it when it's no longer relevant.
  useEffect(() => {
    if (isSecuritiesType && !securities) {
      setSecurities({ security_type: currentType ?? 'Stock', ticker: '', security_description: '', shares: '', gift_date_fmv: '', sale_proceeds: '', broker_name: '' });
    } else if (!isSecuritiesType && securities) {
      setSecurities(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSecuritiesType, currentType]);
  useEffect(() => {
    if (isCheckMethod && !check) {
      setCheck({ check_number: '', check_date: '', bank_name: '' });
    } else if (!isCheckMethod && check) {
      setCheck(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckMethod]);

  // Auto-fill pledge_id when the picked donor has exactly one open
  // pledge. Saves a manual lookup on most gifts toward a commitment.
  // Only fires if pledge_id is empty — we never overwrite an
  // intentional override. If the donor has 0 or 2+ open pledges,
  // pledge_id stays blank for manual choice.
  useEffect(() => {
    if (!values.donor_id) return;
    if (values.pledge_id) return;
    let cancelled = false;
    apiGet<{ pledges: Array<{ pledge_id: number; pledge_status: string; amount_outstanding: number | string }> }>(
      `/api/donors/${values.donor_id}`,
    )
      .then(r => {
        if (cancelled) return;
        const open = (r.pledges ?? []).filter(p =>
          p.pledge_status !== 'Fulfilled' && p.pledge_status !== 'Cancelled' && Number(p.amount_outstanding ?? 0) > 0,
        );
        if (open.length === 1) {
          setValues(prev => prev.pledge_id
            ? prev                                                       // user filled it while we waited
            : { ...prev, pledge_id: open[0].pledge_id });
        }
      })
      .catch(() => { /* ignore — leave the field blank for the user */ });
    return () => { cancelled = true; };
  }, [values.donor_id]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* Dirty tracking */
  const { isDirty, safeNavigate } = useUnsavedChanges({
    values: { ...values, _d: designations, _s: securities, _c: check },
    initialValues: { ...initial, _d: initialDesignations, _s: initialSecurities, _c: initialCheck },
  });

  /* Mutations */
  const createMut = useMutation({
    mutationFn: (body: any) => apiPost<{ donation_id: number }>('/api/donations', body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      setInitial(values); setInitialDesignations(designations);
      setInitialSecurities(securities); setInitialCheck(check);
      navigate(`/donations/${data.donation_id}`);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut<{ donation_id: number }>(`/api/donations/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['donation', id] });
      setInitial(values); setInitialDesignations(designations);
      setInitialSecurities(securities); setInitialCheck(check);
      setTopError(null); setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 2200);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/donations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      setInitial(values); setInitialDesignations(designations);
      navigate('/donations');
    },
    onError: (err: any) => setTopError(err.message ?? 'Delete failed'),
  });

  if (isLoading) return <Loading />;
  if (loadError) return <ErrorBox error={loadError} />;

  function setField(name: string, v: any) {
    setValues(prev => ({ ...prev, [name]: v }));
    if (submitAttempted) {
      const col = ALL_FIELDS.find(c => c.name === name);
      if (col) {
        const next = { ...errors };
        const fieldErr = validateForm([col], { [name]: v })[name];
        if (fieldErr) next[name] = fieldErr; else delete next[name];
        setErrors(next);
      }
    }
  }

  function setSecField(name: string, v: any) {
    setSecurities(prev => ({ ...(prev ?? {}), [name]: v }));
  }
  function setCheckField(name: string, v: any) {
    setCheck(prev => ({ ...(prev ?? {}), [name]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    const errs = validateForm(ALL_FIELDS, values);

    // Designation totals
    const total = Number(values.total_value || 0);
    if (designations.length > 0) {
      const sum = designations.reduce((s, d) => s + Number(d.amount || 0), 0);
      if (Math.abs(sum - total) > 0.01) {
        errs._designations = `Designation amounts ($${sum.toFixed(2)}) must sum to gift total ($${total.toFixed(2)}).`;
      }
      for (const d of designations) {
        if (!d.fund_id) { errs._designations = 'Every designation row needs a fund.'; break; }
        if (!Number(d.amount) || Number(d.amount) <= 0) { errs._designations = 'Every designation amount must be positive.'; break; }
      }
    }

    if (isSecuritiesType && !securities?.security_type) {
      errs._securities = 'Stock / bond donations need a security type.';
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setTopError('Please fix the highlighted fields before saving.');
      const firstKey = Object.keys(errs).find(k => !k.startsWith('_'));
      if (firstKey) {
        const el = document.getElementById(`field-${firstKey}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setTopError(null);

    const body: any = {
      donor_id: Number(values.donor_id),
      donation_type_id: Number(values.donation_type_id),
      donation_date: values.donation_date,
      total_value: Number(values.total_value),
      payment_method_id: values.payment_method_id ? Number(values.payment_method_id) : null,
      solicitation_method_id: values.solicitation_method_id ? Number(values.solicitation_method_id) : null,
      tax_deductible_amount: values.tax_deductible_amount === '' || values.tax_deductible_amount == null
        ? null : Number(values.tax_deductible_amount),
      acknowledgement_status_id: values.acknowledgement_status_id ? Number(values.acknowledgement_status_id) : null,
      acknowledgement_sent_date: values.acknowledgement_sent_date || null,
      pledge_id: values.pledge_id ? Number(values.pledge_id) : null,
      soft_credit_contact_id: values.soft_credit_contact_id ? Number(values.soft_credit_contact_id) : null,
      gift_in_honor_of: values.gift_in_honor_of || null,
      received_via: values.received_via || null,
      external_transaction_id: values.external_transaction_id || null,
      description: values.description || null,
      designations: designations.map(d => ({
        donation_designation_id: d.donation_designation_id ?? null,
        fund_id: Number(d.fund_id),
        amount: Number(d.amount),
        description: d.description || null,
      })),
      securities: securities ? {
        security_type: securities.security_type,
        ticker: securities.ticker || null,
        security_description: securities.security_description || null,
        shares: securities.shares === '' || securities.shares == null ? null : Number(securities.shares),
        gift_date_fmv: securities.gift_date_fmv === '' || securities.gift_date_fmv == null ? null : Number(securities.gift_date_fmv),
        sale_proceeds: securities.sale_proceeds === '' || securities.sale_proceeds == null ? null : Number(securities.sale_proceeds),
        broker_name: securities.broker_name || null,
      } : null,
      check: check ? {
        check_number: check.check_number || null,
        check_date: check.check_date || null,
        bank_name: check.bank_name || null,
      } : null,
    };

    if (isNew) {
      body.assign_receipt_number = assignReceipt;
      createMut.mutate(body);
    } else {
      updateMut.mutate(body);
    }
  }

  function handleDelete() {
    if (!window.confirm('Permanently delete this donation? This cannot be undone.')) return;
    deleteMut.mutate();
  }

  const saving = createMut.isPending || updateMut.isPending;
  const title = !isNew && existing?.donation ? `${existing.donation.donor_name} — ${formatShort(existing.donation.donation_date)}` : 'New donation';

  function renderField(col: ColumnMeta) {
    // Donor gets a "+ New" affordance so the user can create one inline
    // without abandoning the half-filled donation form.
    if (col.name === 'donor_id') {
      return (
        <Cell key={col.name} col={col}>
          <FkCreateField
            label={col.label}
            required={col.required}
            helpText={col.helpText}
            error={errors[col.name] ?? null}
            fkTable="tbl_donor"
            value={values.donor_id ?? null}
            initialLabel={existing?.donation?.donor_name}
            onChange={v => setField('donor_id', v)}
            newButtonLabel="+ New donor"
            renderModal={ctx => <DonorQuickCreateModal {...ctx} />}
          />
        </Cell>
      );
    }
    if (col.name === 'soft_credit_contact_id') {
      return (
        <Cell key={col.name} col={col}>
          <FkCreateField
            label={col.label}
            required={col.required}
            helpText={col.helpText}
            error={errors[col.name] ?? null}
            fkTable="tbl_contact"
            value={values.soft_credit_contact_id ?? null}
            onChange={v => setField('soft_credit_contact_id', v)}
            newButtonLabel="+ New contact"
            renderModal={ctx => <ContactQuickCreateModal {...ctx} />}
          />
        </Cell>
      );
    }
    if (col.name === 'pledge_id') {
      return (
        <Cell key={col.name} col={col}>
          <FkCreateField
            label={col.label}
            required={col.required}
            helpText={col.helpText}
            error={errors[col.name] ?? null}
            fkTable="tbl_pledge"
            value={values.pledge_id ?? null}
            onChange={v => setField('pledge_id', v)}
            newButtonLabel="+ New pledge"
            // If the donor's already chosen on the donation, pre-select it
            // in the pledge modal so the user doesn't pick the same donor twice.
            renderModal={ctx => <PledgeQuickCreateModal {...ctx} defaultDonorId={values.donor_id ?? null} />}
          />
        </Cell>
      );
    }
    if (col.name === 'campaign_id') {
      return (
        <Cell key={col.name} col={col}>
          <FkCreateField
            label={col.label}
            required={col.required}
            helpText={col.helpText}
            error={errors[col.name] ?? null}
            fkTable="tbl_campaign"
            value={values.campaign_id ?? null}
            onChange={v => setField('campaign_id', v)}
            newButtonLabel="+ New campaign"
            renderModal={ctx => <CampaignQuickCreateModal {...ctx} />}
          />
        </Cell>
      );
    }
    return (
      <Cell key={col.name} col={col}>
        <Field
          col={col}
          value={values[col.name]}
          initialFkLabel={initialFkLabel(existing?.donation, col.name)}
          error={errors[col.name] ?? null}
          onChange={v => setField(col.name, v)}
        />
      </Cell>
    );
  }

  return (
    <>
      <PageHeader
        helpSection="donations-recording"
        title={isNew ? 'New' : title}
        emphasis={isNew ? 'donation' : undefined}
        subtitle={isNew ? 'Record a financial gift.' : `Editing donation #${id}.`}
      />

      <FormNavBar
        listLabel="donations" singularLabel="donation" basePath="/donations"
        isNew={isNew} prevId={existing?.prevId ?? null} nextId={existing?.nextId ?? null}
        isDirty={isDirty} savedFlash={savedFlash} onNav={safeNavigate}
      />

      {topError && <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">{topError}</div>}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
        <Section title="Donor" hint="Who's giving, and who gets credit if it's via a DAF or employer match.">
          <FieldGrid>{DONOR_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Gift" hint="What, when, and how the gift came in.">
          <FieldGrid>{GIFT_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        {isSecuritiesType && securities && (
          <Section title={`${securities.security_type || 'Security'} details`}
            hint="Capture ticker / shares / FMV at gift date. Sale proceeds can be filled in later once we liquidate."
            actions={errors._securities && <span className="text-[11px] text-terracotta-deep font-medium">{errors._securities}</span>}>
            <FieldGrid>
              {SECURITIES_FIELDS.map(col => (
                <Cell key={col.name} col={col}>
                  <Field col={col} value={securities[col.name]} onChange={v => setSecField(col.name, v)} />
                </Cell>
              ))}
            </FieldGrid>
          </Section>
        )}

        {isCheckMethod && check && (
          <Section title="Check details">
            <FieldGrid>
              {CHECK_FIELDS.map(col => (
                <Cell key={col.name} col={col}>
                  <Field col={col} value={check[col.name]} onChange={v => setCheckField(col.name, v)} />
                </Cell>
              ))}
            </FieldGrid>
          </Section>
        )}

        <Section
          title="Designations"
          hint="Split the gift across funds. Amounts must sum to the gift total, or leave empty for fully-undesignated."
          actions={errors._designations && <span className="text-[11px] text-terracotta-deep font-medium">{errors._designations}</span>}
        >
          <SubformList<DesignationRow>
            rows={designations}
            onChange={setDesignations}
            emptyHint="No designations — the full gift will be unrestricted / general."
            addLabel="+ Add designation"
            newRow={() => ({ fund_id: null, amount: '' as any, description: '' })}
            headers={
              <div className="grid grid-cols-[1.5fr_140px_1fr] gap-3">
                <div>Fund</div>
                <div>Amount</div>
                <div>Note</div>
              </div>
            }
            renderRow={(row, update) => (
              <div className="grid grid-cols-[1.5fr_140px_1fr] gap-3 items-start">
                <FkSelect
                  fkTable="lkp_fund"
                  value={row.fund_id}
                  required
                  onChange={v => update({ fund_id: v })}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="field-input"
                  value={row.amount ?? ''}
                  onChange={e => update({ amount: e.target.value === '' ? '' : Number(e.target.value) })}
                />
                <input
                  type="text"
                  className="field-input"
                  placeholder="optional note"
                  value={row.description ?? ''}
                  onChange={e => update({ description: e.target.value })}
                />
              </div>
            )}
          />
        </Section>

        <Section title="Pledge linkage" hint="If this payment fulfills a prior commitment.">
          <FieldGrid>{PLEDGE_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Acknowledgement" hint="Track whether a thank-you / tax-deductible letter has been sent.">
          <FieldGrid>{ACK_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <Section title="Source & notes">
          <FieldGrid>{MISC_FIELDS.map(renderField)}</FieldGrid>
        </Section>

        <div className="card flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            {!isNew && (
              <button type="button" onClick={handleDelete} disabled={deleteMut.isPending}
                className="text-sm text-terracotta hover:text-terracotta-deep disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting…' : 'Delete this donation'}
              </button>
            )}
            {isNew && (
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignReceipt}
                  onChange={e => setAssignReceipt(e.target.checked)}
                  className="w-4 h-4 accent-terracotta"
                />
                Auto-assign next receipt number
              </label>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDirty && !saving && <span className="text-[11px] text-ink-faint italic">Unsaved changes</span>}
            <button type="button" onClick={() => safeNavigate(isNew ? '/donations' : `/donations/${id}`)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : (isNew ? 'Record donation' : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

/* ----------------------------------------------------------------- */
/*  Helpers                                                           */
/* ----------------------------------------------------------------- */

function blankForm(): Record<string, any> {
  return {
    donor_id: null, soft_credit_contact_id: null,
    donation_type_id: null, donation_date: '', payment_method_id: null,
    solicitation_method_id: null, total_value: '', tax_deductible_amount: '',
    pledge_id: null, acknowledgement_status_id: null, acknowledgement_sent_date: '',
    gift_in_honor_of: '', received_via: '', external_transaction_id: '', description: '',
  };
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function dateOnly(value: any): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function formatShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function idLabelMap(options: { id: number; label: string }[] | undefined): Map<number, string> {
  const m = new Map<number, string>();
  for (const o of options ?? []) m.set(o.id, o.label);
  return m;
}

function initialFkLabel(d: any, columnName: string): string | undefined {
  if (!d) return undefined;
  switch (columnName) {
    case 'donor_id':                   return d.donor_name;
    case 'donation_type_id':           return d.donation_type;
    case 'payment_method_id':          return d.payment_method;
    case 'solicitation_method_id':     return d.solicitation_method;
    case 'acknowledgement_status_id':  return d.acknowledgement_status;
    case 'soft_credit_contact_id':     return d.soft_credit_name;
    default: return undefined;
  }
}
