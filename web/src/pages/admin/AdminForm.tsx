/**
 * Generic create/edit form for any admin table. Renders one field per
 * column (except hidden / PK on create), validates client-side before
 * submitting, and provides record-level navigation at the top.
 *
 * Routes:
 *   /admin/:table/new        → create
 *   /admin/:table/:id        → edit existing
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api.ts';
import { useAuth } from '../../lib/auth.tsx';
import {
  fetchSchema, toInputValue,
  type AdminSchema, type RowResponse, type ColumnMeta,
} from '../../lib/admin.ts';
import { validateForm, type FormErrors } from '../../lib/adminValidate.ts';
import { PageHeader, Loading, ErrorBox } from '../../components/ui.tsx';
import { Field } from '../../components/admin/Field.tsx';
import { EmailWidget } from '../../components/email/EmailWidget.tsx';
import { AttachmentsWidget } from '../../components/attachments/AttachmentsWidget.tsx';

/** Wraps EmailWidget for the contact admin form, building a friendly
 *  display name from first/last. */
function ContactEmailWidget({ email, firstName, lastName }: { email: string; firstName: string; lastName: string }) {
  const name = `${firstName} ${lastName}`.trim() || email;
  return <EmailWidget email={email} displayName={name} />;
}

/** Map admin table names to attachment entity_types. Tables not in
 *  this map don't get an attachments widget — usually lookup tables
 *  or join tables for which document attachments wouldn't make sense. */
const TABLE_TO_ATTACHMENT_ENTITY: Record<string, string> = {
  tbl_contact:       'contact',
  tbl_vehicle:       'vehicle',
  tbl_corp_facility: 'corp_facility',
  tbl_agency:        'agency',
};

export function AdminForm() {
  const { table, id } = useParams<{ table: string; id: string }>();
  const isNew = id === 'new' || !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // -------------------------------------------------------------------
  // Schema + existing row
  // -------------------------------------------------------------------
  const { data: schema } = useQuery<AdminSchema>({
    queryKey: ['admin', 'schema'],
    queryFn: fetchSchema,
  });
  const meta = schema?.tables.find(t => t.table === table);

  const { data: existing, isLoading: loadingExisting, error: loadError } = useQuery<RowResponse>({
    queryKey: ['admin', 'row', table, id],
    queryFn: () => apiGet(`/api/admin/${table}/${id}`),
    enabled: !isNew && !!meta,
  });

  // -------------------------------------------------------------------
  // Form state
  // -------------------------------------------------------------------
  const [values, setValues] = useState<Record<string, any>>({});
  const [initialValues, setInitialValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<number | null>(null);

  /** Initialize form values from the loaded row (or empty for new). */
  useEffect(() => {
    if (!meta) return;
    setSubmitAttempted(false);
    setErrors({});
    setTopError(null);
    if (isNew) {
      const init: Record<string, any> = {};
      for (const col of meta.columns) {
        if (col.isPk) continue;
        init[col.name] = col.type === 'boolean' ? false : '';
      }
      setValues(init);
      setInitialValues(init);
    } else if (existing) {
      const init: Record<string, any> = {};
      for (const col of meta.columns) {
        init[col.name] = toFormValue(col, existing.row[col.name]);
      }
      setValues(init);
      setInitialValues(init);
    }
  }, [meta, existing, isNew]);

  // Dirty when any value has changed from initial (treating '' and null as equivalent).
  const isDirty = useMemo(() => isDirtyValues(values, initialValues), [values, initialValues]);

  // -------------------------------------------------------------------
  // Prerequisite check — on the New form, warn if any required FK's
  // target table is empty.
  // -------------------------------------------------------------------
  const requiredFkTargets = useMemo(() => {
    if (!meta) return [] as string[];
    const set = new Set<string>();
    for (const c of meta.columns) {
      if (c.isFk && c.required && !c.hideInForm && c.fkTable) set.add(c.fkTable);
    }
    return [...set];
  }, [meta]);

  const { data: counts } = useQuery<Record<string, number>>({
    queryKey: ['admin', 'counts', requiredFkTargets.join(',')],
    queryFn: () => apiGet('/api/admin/_counts', { tables: requiredFkTargets.join(',') }),
    enabled: isNew && requiredFkTargets.length > 0,
  });

  const missingPrereqs = useMemo(() => {
    if (!isNew || !counts || !schema) return [] as { table: string; singular: string; label: string }[];
    return Object.entries(counts)
      .filter(([, n]) => n === 0)
      .map(([t]) => {
        const target = schema.tables.find(x => x.table === t);
        return target ? { table: t, singular: target.singular, label: target.label } : null;
      })
      .filter((x): x is { table: string; singular: string; label: string } => !!x);
  }, [counts, schema, isNew]);

  // -------------------------------------------------------------------
  // Browser-level unsaved-changes guard (tab close / refresh).
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // -------------------------------------------------------------------
  // In-app navigation guarded by a confirm() when dirty.
  // -------------------------------------------------------------------
  function safeNavigate(to: string) {
    if (isDirty) {
      const ok = window.confirm('You have unsaved changes. Leave this page anyway?');
      if (!ok) return;
    }
    navigate(to);
  }

  // -------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------
  const createMut = useMutation({
    mutationFn: (body: any) => apiPost<RowResponse>(`/api/admin/${table}`, body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'list', table] });
      setInitialValues(values); // clear dirty before navigating
      const newId = meta && data?.row?.[meta.pk];
      if (newId) {
        navigate(`/admin/${table}/${newId}`, { replace: true });
      } else {
        navigate(`/admin/${table}`);
      }
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const updateMut = useMutation({
    mutationFn: (body: any) => apiPut<RowResponse>(`/api/admin/${table}/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'list', table] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'row', table, id] });
      setInitialValues(values); // clear dirty state
      setTopError(null);
      setSavedFlash(true);
      if (savedFlashTimer.current) window.clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = window.setTimeout(() => setSavedFlash(false), 2200);
    },
    onError: (err: any) => setTopError(err.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/admin/${table}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'list', table] });
      setInitialValues(values); // bypass dirty guard
      navigate(`/admin/${table}`);
    },
    onError: (err: any) => setTopError(err.message ?? 'Delete failed'),
  });

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  if (!schema || !meta) return <Loading />;
  if (loadingExisting) return <Loading />;
  if (loadError) return <ErrorBox error={loadError} />;

  const formCols = meta.columns.filter(c => !c.hideInForm);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    const errs = validateForm(formCols, values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setTopError(`Please fix the highlighted ${Object.keys(errs).length === 1 ? 'field' : 'fields'} before saving.`);
      // Scroll the first error into view.
      const firstName = Object.keys(errs)[0];
      const el = document.getElementById(`field-${firstName}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setTopError(null);
    const body: Record<string, any> = {};
    for (const col of formCols) {
      body[col.name] = serializeForApi(col, values[col.name]);
    }
    if (isNew) createMut.mutate(body);
    else updateMut.mutate(body);
  }

  function handleFieldChange(colName: string, v: any) {
    setValues(prev => ({ ...prev, [colName]: v }));
    // If we've already attempted submit once, re-validate the field on change
    // so the error clears as soon as it's fixed.
    if (submitAttempted) {
      const col = formCols.find(c => c.name === colName);
      if (col) {
        const next = { ...errors };
        const fieldErr = validateForm([col], { [colName]: v })[colName];
        if (fieldErr) next[colName] = fieldErr; else delete next[colName];
        setErrors(next);
      }
    }
  }

  function handleDelete() {
    const ok = window.confirm(
      `Permanently delete this ${meta!.singular.toLowerCase()}? This cannot be undone.`
    );
    if (ok) deleteMut.mutate();
  }

  const saving = createMut.isPending || updateMut.isPending;
  const deleting = deleteMut.isPending;
  const blocked = missingPrereqs.length > 0;

  return (
    <>
      <PageHeader
        title={isNew ? `New ${meta.singular}` : `Edit ${meta.singular}`}
        subtitle={
          isNew
            ? `Add a new ${meta.singular.toLowerCase()} to the database.`
            : `Editing ${meta.singular.toLowerCase()} #${id}.`
        }
      />

      {/* Top navigation bar — back/prev/next/new */}
      <FormNavBar
        meta={meta}
        isNew={isNew}
        prevId={existing?.prevId ?? null}
        nextId={existing?.nextId ?? null}
        isDirty={isDirty}
        savedFlash={savedFlash}
        onNav={safeNavigate}
      />

      {/* Prerequisite warnings */}
      {missingPrereqs.length > 0 && (
        <div className="mb-5 p-4 bg-gold-soft border border-gold/40 rounded-md text-sm">
          <div className="font-medium text-[#6B4D1E] mb-1">
            {missingPrereqs.length === 1 ? 'A prerequisite is missing' : 'Some prerequisites are missing'}
          </div>
          <div className="text-ink-soft text-[13px] mb-3 leading-snug">
            You can't create a new {meta.singular.toLowerCase()} without first adding{' '}
            {missingPrereqs.length === 1
              ? <>a <strong>{missingPrereqs[0].singular}</strong>.</>
              : <>at least one of each: <strong>{missingPrereqs.map(p => p.singular).join(', ')}</strong>.</>}
          </div>
          <div className="flex flex-wrap gap-2">
            {missingPrereqs.map(p => (
              <button
                key={p.table}
                onClick={() => safeNavigate(`/admin/${p.table}/new`)}
                className="text-xs bg-paper border border-hairline-strong px-3 py-1.5 rounded-md hover:border-terracotta hover:text-terracotta"
              >
                + Add {p.singular}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form error banner */}
      {topError && (
        <div className="mb-5 p-3 bg-terracotta-soft text-terracotta-deep rounded-md text-sm">
          {topError}
        </div>
      )}

      {/* Entity-specific extras. When viewing a single contact, show the
          EmailWidget so staff can see correspondence with this person.
          Useful for vendor / agency contacts that don't have their own
          dedicated detail page. */}
      {!isNew && meta.table === 'tbl_contact' && values.email && (
        <div className="mb-5 max-w-3xl">
          <ContactEmailWidget
            email={String(values.email)}
            firstName={String(values.first_name ?? '')}
            lastName={String(values.last_name ?? '')}
          />
        </div>
      )}

      {/* Attached documents — for entity types that don't have a
          dedicated detail page (contacts, vehicles, facilities, agencies),
          the admin form is where they get their attachments widget. */}
      {!isNew && TABLE_TO_ATTACHMENT_ENTITY[meta.table] && id && (
        <div className="mb-5 max-w-3xl">
          <AttachmentsWidget
            entityType={TABLE_TO_ATTACHMENT_ENTITY[meta.table]}
            entityId={Number(id)}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="card max-w-3xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {formCols.map(col => (
            <div key={col.name} className={col.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <Field
                col={col}
                value={values[col.name]}
                initialFkLabel={existing?.fkLabels[col.name]?.[String(existing.row[col.name])]}
                error={errors[col.name] ?? null}
                onChange={v => handleFieldChange(col.name, v)}
              />
            </div>
          ))}
        </div>

        <div className="mt-7 pt-5 border-t border-hairline flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            {!isNew && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm text-terracotta hover:text-terracotta-deep disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete this record'}
              </button>
            )}
            {/* Per-table extension point: special actions like password reset
                for tbl_user_account. */}
            {!isNew && meta.table === 'tbl_user_account' && id && (
              <ResetPasswordAction userId={Number(id)} />
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDirty && !saving && (
              <span className="text-[11px] text-ink-faint italic">Unsaved changes</span>
            )}
            <button
              type="button"
              onClick={() => safeNavigate(`/admin/${table}`)}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || blocked}
              className="btn-primary disabled:opacity-60"
              title={blocked ? 'Resolve prerequisites first' : undefined}
            >
              {saving ? 'Saving…' : (isNew ? `Create ${meta.singular}` : 'Save changes')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

/* =================================================================== */
/*  Top navigation bar                                                  */
/* =================================================================== */

function FormNavBar({
  meta,
  isNew,
  prevId,
  nextId,
  isDirty,
  savedFlash,
  onNav,
}: {
  meta: { table: string; label: string; singular: string };
  isNew: boolean;
  prevId: number | null;
  nextId: number | null;
  isDirty: boolean;
  savedFlash: boolean;
  onNav: (to: string) => void;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 flex-wrap bg-paper border border-hairline rounded-md px-3 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => onNav(`/admin/${meta.table}`)}
          className="text-xs text-ink-soft hover:text-terracotta inline-flex items-center gap-1"
        >
          ← All {meta.label.toLowerCase()}
        </button>
        <span className="text-hairline-strong">•</span>
        <NavArrowButton
          disabled={isNew || !prevId}
          onClick={() => prevId && onNav(`/admin/${meta.table}/${prevId}`)}
          tooltip={isNew ? 'Save first' : (!prevId ? 'No previous record' : `Previous ${meta.singular.toLowerCase()}`)}
        >
          ← Previous
        </NavArrowButton>
        <NavArrowButton
          disabled={isNew || !nextId}
          onClick={() => nextId && onNav(`/admin/${meta.table}/${nextId}`)}
          tooltip={isNew ? 'Save first' : (!nextId ? 'No next record' : `Next ${meta.singular.toLowerCase()}`)}
        >
          Next →
        </NavArrowButton>
      </div>
      <div className="flex items-center gap-3">
        {savedFlash && (
          <span className="text-xs text-sage font-medium inline-flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Saved
          </span>
        )}
        {!isNew && (
          <button
            type="button"
            onClick={() => onNav(`/admin/${meta.table}/new`)}
            className="text-xs text-ink-soft hover:text-terracotta border border-hairline-strong px-3 py-1 rounded-md hover:border-terracotta"
          >
            + New {meta.singular}
          </button>
        )}
        {isDirty && (
          <span className="w-2 h-2 rounded-full bg-terracotta" title="Unsaved changes" />
        )}
      </div>
    </div>
  );
}

/* =================================================================== */
/*  Per-table extensions                                                */
/* =================================================================== */

/** Admin-driven password reset. Calls /api/auth/users/:id/reset-password,
 *  then surfaces the freshly-generated temp password in an inline reveal
 *  so the admin can copy it once and hand it off to the user. */
function ResetPasswordAction({ userId }: { userId: number }) {
  const { user: me } = useAuth();
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ username: string; temp_password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resetting your own password through this flow doesn't make sense — the
  // backend rejects it and the button should be hidden.
  if (me?.user_account_id === userId) return null;

  async function handleReset() {
    if (!window.confirm("Generate a new temporary password for this user? Their current password will stop working immediately.")) return;
    setError(null);
    setBusy(true);
    try {
      const r = await apiPost<{ username: string; temp_password: string }>(`/api/auth/users/${userId}/reset-password`, {});
      setRevealed(r);
    } catch (err: any) {
      setError(err.message ?? 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  if (revealed) {
    return (
      <div className="inline-flex flex-col gap-1 px-3 py-2 rounded-md bg-gold-soft border border-gold/40">
        <div className="text-[10px] tracking-widest uppercase text-[#6B4D1E] font-medium">Temporary password — copy now, won't be shown again</div>
        <div className="flex items-center gap-2 mt-0.5">
          <code className="font-mono text-sm bg-paper px-2 py-0.5 rounded border border-hairline">{revealed.temp_password}</code>
          <button type="button"
            onClick={() => { navigator.clipboard?.writeText(revealed.temp_password); }}
            className="text-xs text-ink-soft hover:text-terracotta">Copy</button>
          <button type="button"
            onClick={() => setRevealed(null)}
            className="text-xs text-ink-faint hover:text-ink">Done</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={handleReset} disabled={busy}
        className="text-sm text-ink-soft hover:text-terracotta disabled:opacity-50">
        {busy ? 'Generating…' : 'Reset password'}
      </button>
      {error && <span className="text-xs text-terracotta-deep">{error}</span>}
    </>
  );
}

function NavArrowButton({
  disabled,
  onClick,
  tooltip,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={tooltip}
      className="text-xs text-ink-soft hover:text-terracotta disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-ink-soft"
    >
      {children}
    </button>
  );
}

/* =================================================================== */
/*  Helpers                                                             */
/* =================================================================== */

/** Convert an API row value into something the corresponding Field accepts. */
function toFormValue(col: ColumnMeta, value: any): any {
  if (col.isPk) return value;
  if (col.type === 'fk') return value ?? null;
  if (col.type === 'boolean') return !!value;
  if (col.type === 'date' || col.type === 'datetime' || col.type === 'time') return toInputValue(col, value);
  if (col.type === 'number' || col.type === 'money') return value;
  return value ?? '';
}

/** Convert a form value into something the API expects. */
function serializeForApi(col: ColumnMeta, value: any): any {
  if (value === '' || value === undefined) return null;
  if (col.type === 'fk') return value === null ? null : Number(value);
  if (col.type === 'number' || col.type === 'money') return value === null ? null : Number(value);
  if (col.type === 'boolean') return Boolean(value);
  if (col.type === 'datetime' && typeof value === 'string' && value.length === 16) {
    // datetime-local gives "YYYY-MM-DDTHH:MM" with no timezone; server interprets as local.
    return value + ':00';
  }
  return value;
}

/** True if any key differs between two value maps (with '' and null treated as equivalent). */
function isDirtyValues(a: Record<string, any>, b: Record<string, any>): boolean {
  const norm = (v: any) => (v === '' || v === undefined ? null : v);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (norm(a[k]) !== norm(b[k])) return true;
  }
  return false;
}
